/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
/* eslint-disable import/no-cycle */
import {
  Contract,
  JsonRpcProvider,
  Shard,
  toBigInt,
  WebSocketProvider,
  Zone,
} from "quais"
import { Outpoint } from "quais/lib/commonjs/transaction/utxo"
import { QiAddressInfo } from "quais/lib/commonjs/wallet/qi-hdwallet"

import { PELAGUS_NETWORKS } from "../../constants/networks/networks"
import ProviderFactory from "../provider-factory/provider-factory"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import logger from "../../lib/logger"
import { HexString, UNIXTime } from "../../types"
import {
  AccountBalance,
  AddressOnNetwork,
  QiCoinbaseAddress,
  QiWalletBalance,
  QiWalletOnNetwork,
} from "../../accounts"
import {
  AnyAssetAmount,
  AssetTransfer,
  SmartContractFungibleAsset,
} from "../../assets"
import { HOUR, MAILBOX_CONTRACT_ADDRESS, MINUTE, QI } from "../../constants"
import PreferenceService from "../preferences"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import { ChainDatabase, initializeChainDatabase } from "./db"
import BaseService from "../base"
import { getExtendedZoneForAddress } from "./utils"
import { sameQuaiAddress } from "../../lib/utils"
import AssetDataHelper from "./utils/asset-data-helper"
import KeyringService from "../keyring"
import type { ValidatedAddEthereumChainParameter } from "../provider-bridge/utils"
import { MAILBOX_INTERFACE } from "../../contracts/payment-channel-mailbox"
import NotificationsManager from "../notifications"
import { bigIntToDecimal } from "../../redux-slices/utils/asset-utils"
import { AddressCategory } from "./types"

// The number of blocks to query at a time for historic asset transfers.
// Unfortunately there's no "right" answer here that works well across different
// people's account histories. If the number is too large relative to a
// frequently used account, the first call will time out and waste provider
// resources... resulting in an exponential backoff. If it's too small,
// transaction history will appear "slow" to show up for newly imported
// accounts.
const BLOCKS_FOR_TRANSACTION_HISTORY = 128000

// The number of blocks before the current block height to start looking for
// asset transfers. This is important to allow nodes like Erigon and
// OpenEthereum with tracing to catch up to where we are.
const BLOCKS_TO_SKIP_FOR_TRANSACTION_HISTORY = 20

// Add a little bit of wiggle room
const NETWORK_POLLING_TIMEOUT = MINUTE * 2.05

interface Events extends ServiceLifecycleEvents {
  newAccountToTrack: {
    addressOnNetwork: AddressOnNetwork
    source: "import" | "internal" | null
  }
  supportedNetworks: NetworkInterface[]
  accountsWithBalances: {
    /**
     * Retrieved balance for the network's base asset
     */
    balances: AccountBalance[]
    /**
     * The respective address and network for this balance update
     */
    addressOnNetwork: AddressOnNetwork
  }
  updatedQiLedgerBalance: {
    balances: QiWalletBalance[]
    addressOnNetwork: QiWalletOnNetwork
  }
  networkSubscribed: NetworkInterface
  assetTransfers: {
    addressNetwork: AddressOnNetwork
    assetTransfers: AssetTransfer[]
  }
  customChainAdded: ValidatedAddEthereumChainParameter
}

/**
 * ChainService is responsible for basic network monitoring and interaction.
 * Other services rely on the chain service rather than polling networks
 * themselves.
 *
 * The service should provide
 * * Basic cached network information, like the latest block hash and height
 * * Cached account balances, account history, and transaction data
 * * Gas estimation and transaction broadcasting
 * * Event subscriptions, including events whenever
 *   * A new transaction relevant to accounts tracked is found or first
 *     confirmed
 *   * A historic account transaction is pulled and cached
 *   * Any asset transfers found for newly tracked accounts
 *   * A relevant account balance changes
 *   * New blocks
 * * ... and finally, polling and websocket provider-factory for supported networks, in
 *   case a service needs to interact with a network directly.
 */
export default class ChainService extends BaseService<Events> {
  private providerFactory: ProviderFactory

  public jsonRpcProvider: JsonRpcProvider

  public webSocketProvider: WebSocketProvider

  public selectedNetwork: NetworkInterface

  public supportedNetworks = PELAGUS_NETWORKS

  private activeSubscriptions: Map<string, string[]> = new Map()

  subscribedAccounts: {
    account: string
    provider: JsonRpcProvider
  }[]

  subscribedNetworks: {
    network: NetworkInterface
    provider: JsonRpcProvider
  }[]

  private lastUserActivityOnNetwork: {
    [chainID: string]: UNIXTime
  } = Object.fromEntries(
    PELAGUS_NETWORKS.map((network) => [network.chainID, 0])
  )

  private lastUserActivityOnAddress: {
    [address: HexString]: UNIXTime
  } = {}

  static create: ServiceCreatorFunction<
    Events,
    ChainService,
    [
      Promise<ProviderFactory>,
      Promise<PreferenceService>,
      Promise<KeyringService>
    ]
  > = async (providerFactoryService, preferenceService, keyringService) => {
    return new this(
      initializeChainDatabase(),
      await providerFactoryService,
      await preferenceService,
      await keyringService
    )
  }

  assetData: AssetDataHelper

  private constructor(
    private db: ChainDatabase,
    private providerFactoryService: ProviderFactory,
    private preferenceService: PreferenceService,
    private keyringService: KeyringService
  ) {
    super({
      historicAssetTransfers: {
        schedule: {
          periodInMinutes: 6,
        },
        handler: () => {
          this.handleHistoricAssetTransferAlarm()
        },
        runAtStart: false,
      },
      recentIncomingAssetTransfers: {
        schedule: {
          periodInMinutes: 1,
        },
        handler: () => {
          this.handleRecentIncomingAssetTransferAlarm(true)
        },
      },
      forceRecentAssetTransfers: {
        schedule: {
          periodInMinutes: (12 * HOUR) / MINUTE,
        },
        handler: () => {
          this.handleRecentAssetTransferAlarm()
        },
      },
      recentAssetTransfers: {
        schedule: {
          periodInMinutes: 1,
        },
        handler: () => {
          this.handleRecentAssetTransferAlarm(true)
        },
      },
      qiWalletSync: {
        schedule: {
          periodInMinutes: 5,
        },
        handler: () => this.syncQiWallet(),
      },
    })

    this.subscribedAccounts = []
    this.subscribedNetworks = []
    this.providerFactory = providerFactoryService
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()

    await this.db.initialize()

    const { network: networkFromPreferences } =
      await this.preferenceService.getSelectedAccount()

    const { jsonRpcProvider, webSocketProvider } =
      this.providerFactory.getProvidersForNetwork(
        networkFromPreferences.chainID
      )

    this.jsonRpcProvider = jsonRpcProvider
    this.webSocketProvider = webSocketProvider
    this.selectedNetwork = networkFromPreferences

    this.assetData = new AssetDataHelper(jsonRpcProvider)

    const accounts = await this.getAccountsToTrack()

    this.emitter.emit("supportedNetworks", PELAGUS_NETWORKS)

    await this.subscribeOnNetworksAndAddresses(this.supportedNetworks, accounts)

    await this.startAddressBalanceSubscriber()
  }

  public switchNetwork(network: NetworkInterface): void {
    const { jsonRpcProvider, webSocketProvider } =
      this.providerFactory.getProvidersForNetwork(network.chainID)

    this.selectedNetwork = network
    this.jsonRpcProvider = jsonRpcProvider
    this.webSocketProvider = webSocketProvider

    this.subscribedAccounts.map((item) =>
      this.getLatestBaseAccountBalance({ address: item.account, network })
    )

    this.startAddressBalanceSubscriber()
  }

  // --------------------------------------------------------------------------------------------------
  private async startAddressBalanceSubscriber(): Promise<void> {
    const { selectedNetwork } = this
    if (this.isNetworkSubscribed(selectedNetwork)) return

    const [quaiAddresses, qiMiningAddresses] = await Promise.all([
      this.getTrackedAddressesOnNetwork(selectedNetwork),
      globalThis.main.indexingService.getQiCoinbaseAddresses(),
    ])

    const categories: AddressCategory[] = [
      {
        addresses: qiMiningAddresses,
        callback: this.handleQiMiningAddressBalanceUpdate,
      },
      {
        addresses: quaiAddresses,
        callback: this.handleQuaiAddressBalanceUpdate,
      },
    ]
    await this.subscribeToAddressBalances(selectedNetwork, categories)
    this.trackActiveSubscriptions(selectedNetwork, [
      ...quaiAddresses,
      ...qiMiningAddresses,
    ])
  }

  private trackActiveSubscriptions(
    network: NetworkInterface,
    accounts: (AddressOnNetwork | QiCoinbaseAddress | QiAddressInfo)[]
  ) {
    const subscribedAccounts =
      this.activeSubscriptions.get(network.chainID) || []

    accounts.forEach((account) => subscribedAccounts.push(account.address))

    this.activeSubscriptions.set(network.chainID, subscribedAccounts)
  }

  private async subscribeToAddressBalances(
    network: NetworkInterface,
    categories: AddressCategory[]
  ): Promise<void> {
    const { webSocketProvider } = this.providerFactory.getProvidersForNetwork(
      network.chainID
    )

    if (!webSocketProvider)
      logger.error("WebSocketProvider for balance subscription not found")

    // Iterate over each category of addresses and set up the subscription with the specific callback
    categories.forEach(({ addresses, callback }) => {
      if (addresses.length === 0) return

      addresses.forEach(({ address }) => {
        webSocketProvider.on(
          { type: "balance", address },
          async (balance: bigint) => {
            await callback.bind(this)(network, address, balance)
          }
        )
      })
    })
  }

  public async subscribeToQiAddresses(): Promise<void> {
    const { selectedNetwork } = this
    const qiWallet = await this.keyringService.getQiHDWallet()
    const qiAddresses = [
      qiWallet.getGapAddressesForZone(Zone.Cyprus1)[0],
      qiWallet.getGapChangeAddressesForZone(Zone.Cyprus1)[0],
      qiWallet.getGapPaymentChannelAddresses(Zone.Cyprus1)[0],
    ].filter((address) => address !== undefined)

    const categories: AddressCategory[] = [
      {
        addresses: qiAddresses,
        callback: this.handleQiAddressBalanceUpdate,
      },
    ]
    await this.subscribeToAddressBalances(selectedNetwork, categories)
    this.trackActiveSubscriptions(selectedNetwork, qiAddresses)
  }

  private async handleQuaiAddressBalanceUpdate(
    network: NetworkInterface,
    address: string,
    balance: bigint
  ): Promise<void> {
    const asset = await this.db.getBaseAssetForNetwork(network.chainID)
    const accountBalance: AccountBalance = {
      address,
      network,
      assetAmount: {
        asset,
        amount: balance ?? toBigInt(0),
      },
      dataSource: "local",
      retrievedAt: Date.now(),
    }

    // get current selected account balance and compare to get amount of incoming assets
    const selectedAccount = await this.preferenceService.getSelectedAccount()
    const currentAccountState =
      globalThis.main.store.getState().account.accountsData.evm[
        selectedAccount.network.chainID
      ]?.[selectedAccount.address]
    const currentNetworkChainID = selectedAccount.network.chainID

    if (currentAccountState === "loading") return

    const currentBalanceAmount =
      currentAccountState?.balances["QUAI"].assetAmount.amount

    // show this is the current network is selected
    if (
      currentBalanceAmount &&
      balance > currentBalanceAmount &&
      currentNetworkChainID === network.chainID &&
      !this.keyringService.isLocked()
    ) {
      const parsedAmount = bigIntToDecimal(balance - currentBalanceAmount)
      NotificationsManager.createIncomingAssetsNotification(
        parsedAmount,
        asset.symbol,
        address
      )
    }

    this.emitter.emit("accountsWithBalances", {
      balances: [accountBalance],
      addressOnNetwork: {
        address,
        network,
      },
    })
    await this.db.addBalance(accountBalance)
  }

  private async handleQiMiningAddressBalanceUpdate(
    network: NetworkInterface,
    address: string
  ): Promise<void> {
    const outpointReqs = await this.getOutpointsForQiAddress(address)
    const outpoints = outpointReqs.map((outpoint) => ({
      outpoint,
      address,
      account: 0,
      zone: Zone.Cyprus1,
    }))

    if (outpoints.length === 0) return

    const qiWallet = await this.keyringService.getQiHDWallet()
    const paymentCode = qiWallet.getPaymentCode(0)
    qiWallet.importOutpoints(outpoints)

    const serializedQiHDWallet = qiWallet.serialize()
    await this.keyringService.vaultManager.update({
      qiHDWallet: serializedQiHDWallet,
    })

    const qiWalletBalance: QiWalletBalance = {
      paymentCode,
      network,
      assetAmount: {
        asset: QI,
        amount: qiWallet.getBalanceForZone(Zone.Cyprus1),
      },
      dataSource: "local",
      retrievedAt: Date.now(),
    }

    this.emitter.emit("updatedQiLedgerBalance", {
      balances: [qiWalletBalance],
      addressOnNetwork: {
        paymentCode,
        network,
      },
    })
    await this.db.addQiLedgerBalance(qiWalletBalance)
  }

  private async handleQiAddressBalanceUpdate(
    network: NetworkInterface
  ): Promise<void> {
    const qiWallet = await this.keyringService.getQiHDWallet()
    const paymentCode = qiWallet.getPaymentCode(0)
    await qiWallet.scan(Zone.Cyprus1)

    const serializedQiHDWallet = qiWallet.serialize()
    await this.keyringService.vaultManager.update({
      qiHDWallet: serializedQiHDWallet,
    })

    const qiWalletBalance: QiWalletBalance = {
      paymentCode,
      network,
      assetAmount: {
        asset: QI,
        amount: qiWallet.getBalanceForZone(Zone.Cyprus1),
      },
      dataSource: "local",
      retrievedAt: Date.now(),
    }

    this.emitter.emit("updatedQiLedgerBalance", {
      balances: [qiWalletBalance],
      addressOnNetwork: {
        paymentCode,
        network,
      },
    })
    await this.db.addQiLedgerBalance(qiWalletBalance)
  }

  private isNetworkSubscribed(network: NetworkInterface): boolean {
    return this.activeSubscriptions.has(network.chainID)
  }

  public async onNewQiAccountCreated(
    qiCoinbaseAddress: QiCoinbaseAddress
  ): Promise<void> {
    await this.subscribeToAddressBalances(this.selectedNetwork, [
      {
        addresses: [qiCoinbaseAddress],
        callback: this.handleQiMiningAddressBalanceUpdate,
      },
    ])
    this.trackActiveSubscriptions(this.selectedNetwork, [qiCoinbaseAddress])
  }

  public async onNewAccountCreated(
    network: NetworkInterface,
    newAccount: AddressOnNetwork
  ): Promise<void> {
    const subscribedAccountsOnNetwork = this.activeSubscriptions.get(
      network.chainID
    )

    if (subscribedAccountsOnNetwork) {
      this.subscribeToAddressBalances(network, [
        {
          addresses: [newAccount],
          callback: this.handleQuaiAddressBalanceUpdate,
        },
      ])
      subscribedAccountsOnNetwork.push(newAccount.address)

      return
    }

    const provider = this.providerFactory.getProvidersForNetwork(
      network.chainID
    )

    if (provider) {
      const accounts = await this.getTrackedAddressesOnNetwork(network)

      this.subscribeToAddressBalances(network, [
        {
          addresses: accounts,
          callback: this.handleQuaiAddressBalanceUpdate,
        },
      ])
      this.trackActiveSubscriptions(network, accounts)
    }
  }

  private subscribeOnNetworksAndAddresses = async (
    networks: NetworkInterface[],
    accounts: AddressOnNetwork[]
  ): Promise<void> => {
    networks.forEach((network) => {
      Promise.allSettled([
        this.subscribeToNewHeads(network),
        this.emitter.emit("networkSubscribed", network),
      ]).catch((e) => logger.error(e))

      accounts.forEach(async (account) => {
        const { address } = account
        Promise.allSettled([
          this.addAccountToTrack({
            address,
            network,
          }),
        ]).catch((e) => logger.error(e))
      })
    })
  }

  async getAccountsToTrack(
    onlyActiveAccounts = false
  ): Promise<AddressOnNetwork[]> {
    const accounts = await this.db.getAccountsToTrack()
    if (onlyActiveAccounts) {
      return accounts.filter(
        ({ address, network }) =>
          this.isCurrentlyActiveAddress(address) &&
          this.isCurrentlyActiveChainID(network.chainID)
      )
    }
    return accounts
  }

  async getTrackedAddressesOnNetwork(
    network: NetworkInterface
  ): Promise<AddressOnNetwork[]> {
    return this.db.getTrackedAddressesOnNetwork(network)
  }

  async removeAccountToTrack(address: string): Promise<void> {
    await this.db.removeAccountToTrack(address)
  }

  async getOutpointsForQAddresses(address: string): Promise<Outpoint[]> {
    return await this.jsonRpcProvider.getOutpointsByAddress(address)
  }

  async syncQiWallet(forceFullScan = false): Promise<void> {
    try {
      const network = this.selectedNetwork
      const qiWallet = await this.keyringService.getQiHDWallet()
      const paymentCode = qiWallet.getPaymentCode(0)

      let notifications: string[] = []
      try {
        const mailboxContract = new Contract(
          MAILBOX_CONTRACT_ADDRESS || "",
          MAILBOX_INTERFACE,
          this.jsonRpcProvider
        )
        notifications = await mailboxContract.getNotifications(paymentCode)
      } catch (error) {
        console.error(
          "Error getting notifications. Make sure mailbox contract is deployed on the same network as the wallet."
        )
      }

      qiWallet.connect(this.jsonRpcProvider)
      notifications.forEach((paymentCode) => {
        // if the channel is already open, it will be ignored
        qiWallet.openChannel(paymentCode)
      })

      if (forceFullScan) {
        await qiWallet.scan(Zone.Cyprus1)
      } else {
        await qiWallet.sync(Zone.Cyprus1)
      }

      const balance = qiWallet.getBalanceForZone(Zone.Cyprus1)

      const qiWalletBalance: QiWalletBalance = {
        paymentCode,
        network,
        assetAmount: {
          asset: QI,
          amount: balance,
        },
        dataSource: "local",
        retrievedAt: Date.now(),
      }

      this.emitter.emit("updatedQiLedgerBalance", {
        balances: [qiWalletBalance],
        addressOnNetwork: {
          paymentCode,
          network,
        },
      })

      await this.db.addQiLedgerBalance(qiWalletBalance)

      await this.keyringService.vaultManager.add(
        {
          qiHDWallet: qiWallet.serialize(),
        },
        {}
      )
      this.subscribeToQiAddresses()
    } catch (error) {
      logger.error("Error getting qi wallet balance for address", error)
    }
  }

  async getOutpointsForQiAddress(address: string): Promise<Outpoint[]> {
    return this.jsonRpcProvider.getOutpointsByAddress(address)
  }

  async getLatestBaseAccountBalance({
    address,
    network,
  }: AddressOnNetwork): Promise<AccountBalance> {
    const prevShard = globalThis.main.SelectedShard

    const addrShard = getExtendedZoneForAddress(address)

    if (globalThis.main.SelectedShard !== addrShard) {
      globalThis.main.SetShard(addrShard)
    }

    let err = false
    let balance: bigint | undefined = toBigInt(0)

    try {
      const { jsonRpcProvider } = this.providerFactory.getProvidersForNetwork(
        network.chainID
      )
      balance = await jsonRpcProvider.getBalance(address, "latest")
    } catch (error) {
      if (error instanceof Error) {
        logger.error("Error getting balance for address", address, error)
        err = true // only reset user-displayed error if there's no error at all
        if (error.message.includes("could not detect network")) {
          globalThis.main.SetNetworkError({
            chainId: network.chainID,
            error: true,
          })
        }
        logger.error(
          `Global shard: ${globalThis.main.SelectedShard} Address shard: ${addrShard} Provider: ${this.jsonRpcProvider}`
        )
      }
    } finally {
      if (!err) {
        globalThis.main.SetNetworkError({
          chainId: network.chainID,
          error: false,
        })
      }
    }

    const trackedAccounts = await this.getAccountsToTrack()

    const allTrackedAddresses = new Set(
      trackedAccounts.map((account) => account.address)
    )

    const asset = await this.db.getBaseAssetForNetwork(network.chainID)

    const accountBalance: AccountBalance = {
      address,
      network,
      assetAmount: {
        asset,
        amount: balance ?? toBigInt(0),
      },
      dataSource: "local",
      retrievedAt: Date.now(),
    }

    // Don't emit or save if the account isn't tracked
    if (allTrackedAddresses.has(address)) {
      this.emitter.emit("accountsWithBalances", {
        balances: [accountBalance],
        addressOnNetwork: {
          address,
          network,
        },
      })

      await this.db.addBalance(accountBalance)
    }

    globalThis.main.SetShard(prevShard)

    return accountBalance
  }

  async addAccountToTrack(addressNetwork: AddressOnNetwork): Promise<void> {
    const source = await this.keyringService.getKeyringSourceForAddress(
      addressNetwork.address
    )

    const isAccountOnNetworkAlreadyTracked =
      await this.db.getTrackedAccountOnNetwork(addressNetwork)

    if (!isAccountOnNetworkAlreadyTracked) {
      // Skip save, emit and savedTransaction emission on resubmission
      await this.db.addAccountToTrack(addressNetwork)
      this.emitter.emit("newAccountToTrack", {
        addressOnNetwork: addressNetwork,
        source,
      })
      await this.onNewAccountCreated(addressNetwork.network, addressNetwork)
    }

    this.getLatestBaseAccountBalance(addressNetwork).catch((e) => {
      logger.error(
        "chainService/addAccountToTrack: Error getting latestBaseAccountBalance",
        e
      )
    })

    if (source !== "internal") {
      this.loadHistoricAssetTransfers(addressNetwork).catch((e) => {
        logger.error(
          "chainService/addAccountToTrack: Error loading historic asset transfers",
          e
        )
      })
    }
  }

  /* *****************
   * PRIVATE METHODS *
   * **************** */

  /**
   * Load recent asset transfers from an account on a particular network.
   *
   * @param addressNetwork the address and network whose asset transfers we need
   */
  private async loadRecentAssetTransfers(
    addressNetwork: AddressOnNetwork
  ): Promise<void> {
    const shard = getExtendedZoneForAddress(
      addressNetwork.address,
      false
    ) as Shard

    const blockHeight =
      (await this.jsonRpcProvider.getBlockNumber(shard)) -
      BLOCKS_TO_SKIP_FOR_TRANSACTION_HISTORY

    // TODO - import blockService in future service with tx
    // const blockHeight =
    //   (await this.blockService.getBlockHeight(addressNetwork.network)) -
    //   BLOCKS_TO_SKIP_FOR_TRANSACTION_HISTORY
    const fromBlock = blockHeight - BLOCKS_FOR_TRANSACTION_HISTORY

    try {
      return await this.loadAssetTransfers(
        addressNetwork,
        BigInt(fromBlock),
        BigInt(blockHeight)
      )
    } catch (err) {
      logger.error(
        "Failed loaded recent assets, retrying with shorter block range",
        addressNetwork,
        err
      )
    }

    return Promise.resolve()
  }

  /**
   * Continue to load historic asset transfers, finding the oldest lookup and
   * searching for asset transfers before that block.
   *
   * @param addressNetwork The account whose asset transfers are being loaded.
   */
  private async loadHistoricAssetTransfers(
    addressNetwork: AddressOnNetwork
  ): Promise<void> {
    const shard = getExtendedZoneForAddress(
      addressNetwork.address,
      false
    ) as Shard

    const oldest =
      (await this.db.getOldestAccountAssetTransferLookup(addressNetwork)) ??
      BigInt(await this.jsonRpcProvider.getBlockNumber(shard))

    // TODO - import blockService in future service with tx
    // BigInt(await this.blockService.getBlockHeight(addressNetwork.network))

    if (oldest !== 0n) {
      await this.loadAssetTransfers(addressNetwork, 0n, oldest)
    }
  }

  /**
   * Load asset transfers from an account on a particular network within a
   * particular block range. Emit events for any transfers found, and look up
   * any related transactions and blocks.
   *
   * @param addressOnNetwork the address and network whose asset transfers we need
   * @param startBlock
   * @param endBlock
   */
  private async loadAssetTransfers(
    addressOnNetwork: AddressOnNetwork,
    startBlock: bigint,
    endBlock: bigint
  ): Promise<void> {
    if (
      this.supportedNetworks.every(
        (network) => network.chainID !== addressOnNetwork.network.chainID
      )
    ) {
      logger.error(
        `Asset transfer check not supported on network ${JSON.stringify(
          addressOnNetwork.network
        )}`
      )
    }

    const assetTransfers = await this.assetData.getAssetTransfers()

    await this.db.recordAccountAssetTransferLookup(
      addressOnNetwork,
      startBlock,
      endBlock
    )

    this.emitter.emit("assetTransfers", {
      addressNetwork: addressOnNetwork,
      assetTransfers,
    })
  }

  /**
   * Check for any incoming asset transfers involving tracked accounts.
   */
  private async handleRecentIncomingAssetTransferAlarm(
    onlyActiveAccounts = false
  ): Promise<void> {
    const accountsToTrack = await this.getAccountsToTrack(onlyActiveAccounts)
    await Promise.allSettled(
      accountsToTrack.map(async (addressNetwork) => {
        return this.loadRecentAssetTransfers(addressNetwork)
      })
    )
  }

  private isCurrentlyActiveChainID(chainID: string): boolean {
    return (
      Date.now() <
      this.lastUserActivityOnNetwork[chainID] + NETWORK_POLLING_TIMEOUT
    )
  }

  private isCurrentlyActiveAddress(address: HexString): boolean {
    return (
      Date.now() <
      this.lastUserActivityOnAddress[address] + NETWORK_POLLING_TIMEOUT
    )
  }

  /**
   * Check for any incoming or outgoing asset transfers involving tracked accounts.
   */
  private async handleRecentAssetTransferAlarm(
    onlyActiveAccounts = false
  ): Promise<void> {
    const accountsToTrack = await this.getAccountsToTrack(onlyActiveAccounts)

    await Promise.allSettled(
      accountsToTrack.map((addressNetwork) =>
        this.loadRecentAssetTransfers(addressNetwork)
      )
    )
  }

  private async handleHistoricAssetTransferAlarm(): Promise<void> {
    const accountsToTrack = await this.getAccountsToTrack()

    await Promise.allSettled(
      accountsToTrack.map((an) => this.loadHistoricAssetTransfers(an))
    )
  }

  /**
   * Given a list of AddressOnNetwork objects, return only the ones that
   * are currently being tracked.
   */
  async filterTrackedAddressesOnNetworks(
    addressesOnNetworks: AddressOnNetwork[]
  ): Promise<AddressOnNetwork[]> {
    const accounts = await this.getAccountsToTrack()

    return addressesOnNetworks.filter(({ address, network }) =>
      accounts.some(
        ({ address: trackedAddress, network: trackedNetwork }) =>
          sameQuaiAddress(trackedAddress, address) &&
          network.baseAsset.name === trackedNetwork.baseAsset.name
      )
    )
  }

  /**
   * Watch a network for new blocks, saving each to the database and emitting an
   * event. Re-orgs are currently ignored.
   *
   * @param network The network to watch.
   */
  private async subscribeToNewHeads(network: NetworkInterface): Promise<void> {
    const { jsonRpcProvider, subscribedNetworks } = this

    if (!jsonRpcProvider) throw new Error("Failed to subscribe to new heads")

    subscribedNetworks.push({
      network,
      provider: jsonRpcProvider,
    })
  }

  async queryAccountTokenDetails(
    contractAddress: string,
    addressOnNetwork: AddressOnNetwork,
    existingAsset?: SmartContractFungibleAsset
  ): Promise<AnyAssetAmount<SmartContractFungibleAsset>> {
    const { network } = addressOnNetwork

    const balance = await this.assetData.getTokenBalance(
      addressOnNetwork,
      contractAddress
    )

    if (existingAsset)
      return {
        asset: existingAsset,
        amount: balance.amount,
      }

    const asset = await this.assetData
      .getTokenMetadata({
        contractAddress,
        homeNetwork: network,
      })
      .catch(() => undefined)

    if (!asset) {
      throw logger.buildError(
        "Unable to retrieve metadata for custom asset",
        contractAddress,
        "on chain:",
        network.chainID
      )
    }

    return {
      asset: { ...asset, decimals: Number(asset.decimals) },
      amount: balance.amount,
    }
  }
}
