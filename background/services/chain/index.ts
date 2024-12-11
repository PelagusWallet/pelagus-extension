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
  denominations,
  NeuteredAddressInfo,
  Block,
} from "quais"
import { JsonRpcProvider as EthJsonRpcProvider } from "ethers"
import { Outpoint } from "quais/lib/commonjs/transaction/utxo"
import {
  QiAddressInfo,
  QiHDWallet,
} from "quais/lib/commonjs/wallet/qi-hdwallet"

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
import { ChainDatabase, initializeChainDatabase, QiOutpoint } from "./db"
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

  public immediateJsonRpcProvider: JsonRpcProvider

  public webSocketProvider: WebSocketProvider

  public ethJsonRpcProvider: EthJsonRpcProvider

  public selectedNetwork: NetworkInterface

  public supportedNetworks = PELAGUS_NETWORKS

  private activeSubscriptions: Map<string, string[]> = new Map()

  private qiWalletSyncInProgress: boolean = false

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

    const {
      jsonRpcProvider,
      webSocketProvider,
      immediateJsonRpcProvider,
      ethJsonRpcProvider,
    } = this.providerFactory.getProvidersForNetwork(
      networkFromPreferences.chainID
    )

    this.jsonRpcProvider = jsonRpcProvider
    this.webSocketProvider = webSocketProvider
    this.immediateJsonRpcProvider = immediateJsonRpcProvider ?? jsonRpcProvider
    this.ethJsonRpcProvider = ethJsonRpcProvider!
    this.selectedNetwork = networkFromPreferences

    this.assetData = new AssetDataHelper(jsonRpcProvider)

    const accounts = await this.getAccountsToTrack()

    this.emitter.emit("supportedNetworks", PELAGUS_NETWORKS)

    await this.subscribeOnNetworksAndAddresses(this.supportedNetworks, accounts)

    await this.startAddressBalanceSubscriber()
  }

  public switchNetwork(network: NetworkInterface): void {
    const { jsonRpcProvider, webSocketProvider, immediateJsonRpcProvider } =
      this.providerFactory.getProvidersForNetwork(network.chainID)

    this.selectedNetwork = network
    this.jsonRpcProvider = jsonRpcProvider
    this.webSocketProvider = webSocketProvider
    this.immediateJsonRpcProvider = immediateJsonRpcProvider ?? jsonRpcProvider

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
        callback: this.syncQiWallet,
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
      ...qiWallet.openChannels.map(
        (channel) =>
          qiWallet.getGapPaymentChannelAddressesForZone(
            channel,
            Zone.Cyprus1
          )[0]
      ),
    ].filter((address) => address !== undefined)

    const categories: AddressCategory[] = [
      {
        addresses: qiAddresses,
        callback: this.syncQiWallet,
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
      lockedAmount: {
        asset,
        amount: BigInt(0),
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

    try {
      const lockedBalance =
        await this.immediateJsonRpcProvider.getLockedBalance(address)
      accountBalance.lockedAmount = {
        asset,
        amount: lockedBalance,
      }
    } catch (error: any) {
      logger.error(
        `Error getting locked balance after balance update for ${address}: ${
          error?.message || error
        }`
      )
    }

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

  private isNetworkSubscribed(network: NetworkInterface): boolean {
    return this.activeSubscriptions.has(network.chainID)
  }

  public async onNewQiAccountCreated(
    qiCoinbaseAddress: QiCoinbaseAddress
  ): Promise<void> {
    await this.subscribeToAddressBalances(this.selectedNetwork, [
      {
        addresses: [qiCoinbaseAddress],
        callback: this.syncQiWallet,
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
          callback: (network, address, balance) =>
            this.handleQuaiAddressBalanceUpdate(network, address, balance),
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

  private async handleOutpointsCreated(outpoints: {
    [address: string]: Outpoint[]
  }): Promise<void> {
    // Flatten the outpoints array and map each outpoint to include its address
    const qiOutpoints = Object.entries(outpoints).flatMap(
      ([address, outpoints]) =>
        outpoints.map((outpoint) => ({
          outpoint,
          address,
          chainID: this.selectedNetwork.chainID,
          value: denominations[outpoint.denomination],
        }))
    )

    await this.db.addQiOutpoints(qiOutpoints)
  }

  private async handleOutpointsDeleted(outpoints: {
    [address: string]: Outpoint[]
  }): Promise<void> {
    // Flatten the outpoints array and map each outpoint to include its address
    const qiOutpoints = Object.entries(outpoints).flatMap(
      ([address, outpoints]) =>
        outpoints.map((outpoint) => ({
          outpoint,
          address,
          chainID: this.selectedNetwork.chainID,
          value: denominations[outpoint.denomination],
        }))
    )
    await this.db.removeQiOutpoints(qiOutpoints)
  }

  async syncQiWallet(): Promise<void> {
    if (this.qiWalletSyncInProgress) {
      // A sync is already in progress. Silently return.
      return
    }

    this.qiWalletSyncInProgress = true
    setTimeout(async () => {
      try {
        const network = this.selectedNetwork
        const lastScan = await this.db.getQiLastFullScan(network.chainID)
        const forceFullScan = lastScan ? false : true
        const qiWallet = await this.keyringService.getQiHDWallet()
        if (!qiWallet) {
          // it's possible that the wallet does not exist (quai private key was imported)
          // or the wallet has not been initialized yet after wallet creation/restoration
          return Promise.resolve()
        }

        const paymentCode = qiWallet.getPaymentCode(0)
        let notifications: string[] = []
        try {
          const mailboxContract = new Contract(
            MAILBOX_CONTRACT_ADDRESS || "",
            MAILBOX_INTERFACE,
            this.jsonRpcProvider
          )
          const notificationsValue = await mailboxContract.getNotifications(
            paymentCode
          )
          notifications = notificationsValue
        } catch (error: any) {
          logger.error(
            `Error getting notifications. Make sure mailbox contract is deployed on the same network as the wallet. Error: ${
              error?.message || error
            }`
          )
        }

        qiWallet.connect(this.jsonRpcProvider)
        notifications.forEach((paymentCode) => {
          // if the channel is already open, it will be ignored
          qiWallet.openChannel(paymentCode)
        })

        const currentBlock = await this.jsonRpcProvider.getBlock(
          Shard.Cyprus1,
          "latest"
        )

        let storeOutpoints = false
        let spendableBalance: bigint = BigInt(0)
        let lockedBalance: bigint = BigInt(0)

        if (forceFullScan) {
          // use immediateJsonRpcProvider to avoid race condition
          qiWallet.connect(this.immediateJsonRpcProvider)
          await qiWallet.scan(Zone.Cyprus1, 0)

          // switch back to jsonRpcProvider
          qiWallet.connect(this.jsonRpcProvider)
          storeOutpoints = true

          // calculate spendable balance for the current block using in memory outpoints
          spendableBalance = await qiWallet.getSpendableBalanceForZone(
            Zone.Cyprus1,
            currentBlock?.woHeader.number,
            true
          )
          lockedBalance = await qiWallet.getLockedBalanceForZone(
            Zone.Cyprus1,
            currentBlock?.woHeader.number,
            true
          )
        } else {
          await qiWallet.sync(
            Zone.Cyprus1,
            0,
            this.handleOutpointsCreated.bind(this),
            this.handleOutpointsDeleted.bind(this)
          )

          // fetch spendable balance for the current block using getBalance RPC
          const [sBalance, lBalance] = await Promise.all([
            qiWallet.getSpendableBalanceForZone(
              Zone.Cyprus1,
              currentBlock?.woHeader.number,
              false
            ),
            qiWallet.getLockedBalanceForZone(
              Zone.Cyprus1,
              currentBlock?.woHeader.number,
              false
            ),
          ])
          spendableBalance = sBalance
          lockedBalance = lBalance
        }

        const qiWalletBalance: QiWalletBalance = {
          paymentCode,
          network,
          assetAmount: {
            asset: QI,
            amount: spendableBalance,
          },
          lockedAmount: {
            asset: QI,
            amount: lockedBalance,
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
        await Promise.all([
          this.subscribeToQiAddresses(),
          this.db.addQiLedgerBalance(qiWalletBalance),
          // globalThis.main.transactionService.checkReceivedQiTransactions(),
          new Promise<void>(async (resolve): Promise<void> => {
            if (storeOutpoints) {
              const outpoints = qiWallet.getOutpoints(Zone.Cyprus1)
              const qiOutpoints = outpoints.map((outpointInfo) => ({
                outpoint: outpointInfo.outpoint,
                address: outpointInfo.address,
                chainID: network.chainID,
                value: denominations[outpointInfo.outpoint.denomination],
              }))
              await this.db.addQiOutpoints(qiOutpoints)
            }
            resolve()
          }),
          new Promise<void>(async (resolve): Promise<void> => {
            if (forceFullScan) {
              await this.db.setQiLastFullScan(
                this.selectedNetwork.chainID,
                currentBlock?.woHeader.number!,
                currentBlock?.hash!
              )
            } else {
              await this.db.setQiLastSync(
                this.selectedNetwork.chainID,
                currentBlock?.woHeader.number!,
                currentBlock?.hash!
              )
            }
            resolve()
          }),
        ])

        // save the wallet to the vault
        const serializedQiWallet = { qiHDWallet: qiWallet.serialize() }
        await this.keyringService.vaultManager.add(serializedQiWallet, {})
      } catch (error: any) {
        logger.error("Error occurred during Qi wallet sync", error.message)
      } finally {
        // Reset the flag regardless of success or failure
        this.qiWalletSyncInProgress = false
      }
    }, 0)
  }

  async getOutpointsForQiAddress(address: string): Promise<Outpoint[]> {
    return this.jsonRpcProvider.getOutpointsByAddress(address)
  }

  async getOutpointsForSending(
    minimumAmt: bigint,
    bufferPercentage: number = 10
  ): Promise<QiOutpoint[]> {
    return this.db.loadQiOutpointsForSending(
      minimumAmt,
      this.selectedNetwork.chainID,
      await this.jsonRpcProvider.getBlockNumber(Shard.Cyprus1),
      bufferPercentage
    )
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
    let spendableBalance: bigint = BigInt(0)
    let lockedBalance: bigint = BigInt(0)
    try {
      const [sBalance, lBalance] = await Promise.all([
        this.immediateJsonRpcProvider!.getBalance(address, "latest"),
        this.immediateJsonRpcProvider!.getLockedBalance(address),
      ])

      spendableBalance = sBalance
      lockedBalance = lBalance
    } catch (error: any) {
      logger.error(
        `Error getting balance for ${address}: ${error?.message || error}`
      )
      if (error instanceof Error) {
        err = true // only reset user-displayed error if there's no error at all
        if (error.message.includes("could not detect network")) {
          globalThis.main.SetNetworkError({
            chainId: network.chainID,
            error: true,
          })
        }
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
        amount: spendableBalance,
      },
      lockedAmount: {
        asset,
        amount: lockedBalance,
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

  // Inside the ChainService class

  /**
   * Find a previous coinbase address by querying the database for addresses
   * with more than a certain number of unique transactions in their outpoints.
   *
   * @param qiWallet - The QiHDWallet instance.
   * @param zone - The zone to filter addresses.
   * @param existingAddressesSet - A set of addresses to exclude.
   * @returns A promise that resolves to a NeuteredAddressInfo or undefined.
   */
  async findPreviousCoinbaseAddresses(
    qiWallet: QiHDWallet,
    zone: Zone,
    existingAddressesSet: Set<string>
  ): Promise<NeuteredAddressInfo | null> {
    const chainID = this.selectedNetwork.chainID

    // Get addresses that have more than 3 unique transactions
    const possibleAddresses =
      await this.db.getPossibleCoinbaseAddressesFromOutpoints(
        chainID,
        zone,
        3,
        existingAddressesSet
      )

    if (possibleAddresses.length === 0) {
      return null
    }

    // Map the addresses back to NeuteredAddressInfo from the qiWallet
    const addresses: NeuteredAddressInfo[] = []
    for (const addressInfo of qiWallet.getAddressesForZone(zone)) {
      if (possibleAddresses.includes(addressInfo.address)) {
        addresses.push(addressInfo)
      }
    }

    // sort by index
    addresses.sort((a, b) => a.index - b.index)
    return addresses.length > 0 ? addresses[0] : null
  }
}
