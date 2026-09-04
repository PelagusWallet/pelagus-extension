/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-cycle */
import {
  Contract,
  JsonRpcProvider,
  Shard,
  WebSocketProvider,
  Zone,
  denominations,
  NeuteredAddressInfo,
  OutpointInfo,
} from "quais"
import { JsonRpcProvider as EthJsonRpcProvider } from "ethers"
import browser from "webextension-polyfill"
import { Outpoint } from "quais/lib/commonjs/transaction/utxo"
import { QiHDWallet } from "quais/lib/commonjs/wallet/qi-hdwallet"

import { PELAGUS_NETWORKS } from "../../constants/networks/networks"
import ProviderFactory from "../provider-factory/provider-factory"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import logger from "../../lib/logger"
import { HexString } from "../../types"
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
import { setQiWalletSyncInProgress } from "../../redux-slices/ui"

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

const currentVersion = "45" // Update this when wallet version changes

interface QiWalletSyncOptions {
  forceFullScan?: boolean
  ignoreRecentSync?: boolean
  requireFreshScan?: boolean
}

interface BaseBalanceRefreshOptions {
  force?: boolean
  maxAgeMs?: number
}

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
  addressAccessed: {
    address: string
    blockHash: string
    network: NetworkInterface
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

  private activeSubscriptions: Map<string, Set<string>> = new Map()

  private qiWalletSyncInProgress: boolean = false

  private qiWalletSyncPromise: Promise<void> | null = null

  private qiWalletSyncOptions: QiWalletSyncOptions | null = null

  private queuedQiWalletSyncOptions: QiWalletSyncOptions | null = null

  private queuedQiWalletSyncPromise: Promise<void> | null = null

  private qiWalletBalanceSyncTimer: ReturnType<typeof setTimeout> | null = null

  private baseBalanceRequests: Map<
    string,
    { force: boolean; request: Promise<AccountBalance> }
  > = new Map()

  private processedAddressAccesses: Map<
    string,
    ReturnType<typeof setTimeout>
  > = new Map()

  subscribedAccounts: {
    account: string
    provider: JsonRpcProvider
  }[]

  subscribedNetworks: {
    network: NetworkInterface
    provider: JsonRpcProvider
  }[]

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
      forceRecentAssetTransfers: {
        schedule: {
          periodInMinutes: (12 * HOUR) / MINUTE,
        },
        handler: () => {
          this.handleRecentAssetTransferAlarm()
        },
      },
      qiWalletSync: {
        schedule: {
          periodInMinutes: 15,
        },
        handler: () => this.syncQiWallet(),
      },
    })

    this.subscribedAccounts = []
    this.subscribedNetworks = []
    this.providerFactory = providerFactoryService
    this.handleQiWalletBalanceUpdate = this.handleQiWalletBalanceUpdate.bind(this)
    this.handleQuaiAddressAccess = this.handleQuaiAddressAccess.bind(this)
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()
    await Promise.all([
      browser.alarms.clear("recentIncomingAssetTransfers"),
      browser.alarms.clear("recentAssetTransfers"),
    ])

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

    await this.subscribeOnNetworksAndAddresses([networkFromPreferences], accounts)

    await this.startAddressAccessSubscriber()
  }

  override async internalStopService(): Promise<void> {
    for (const timer of this.processedAddressAccesses.values()) {
      clearTimeout(timer)
    }
    this.processedAddressAccesses.clear()
    await super.internalStopService()
  }

  public switchNetwork(network: NetworkInterface): void {
    const { jsonRpcProvider, webSocketProvider, immediateJsonRpcProvider } =
      this.providerFactory.getProvidersForNetwork(network.chainID)

    this.selectedNetwork = network
    this.jsonRpcProvider = jsonRpcProvider
    this.webSocketProvider = webSocketProvider
    this.immediateJsonRpcProvider = immediateJsonRpcProvider ?? jsonRpcProvider

    this.startAddressAccessSubscriber()
  }

  public getJsonRpcProviderForNetwork(chainID: string): JsonRpcProvider {
    return this.providerFactory.getProvidersForNetwork(chainID).jsonRpcProvider
  }

  public async refreshProviders(): Promise<void> {
    if (this.selectedNetwork) {
      const { jsonRpcProvider, webSocketProvider, immediateJsonRpcProvider } =
        this.providerFactory.getProvidersForNetwork(this.selectedNetwork.chainID)
      const webSocketProviderChanged =
        webSocketProvider !== this.webSocketProvider

      this.jsonRpcProvider = jsonRpcProvider
      this.webSocketProvider = webSocketProvider
      this.immediateJsonRpcProvider = immediateJsonRpcProvider ?? jsonRpcProvider

      if (webSocketProviderChanged) {
        this.activeSubscriptions.delete(this.selectedNetwork.chainID)
        await this.startAddressAccessSubscriber()
      }
    }
  }

  // --------------------------------------------------------------------------------------------------
  private async startAddressAccessSubscriber(): Promise<void> {
    const { selectedNetwork } = this
    if (this.isNetworkSubscribed(selectedNetwork)) return

    const [quaiAddresses, qiMiningAddresses] = await Promise.all([
      this.getTrackedAddressesOnNetwork(selectedNetwork),
      globalThis.main.indexingService.getQiCoinbaseAddresses(),
    ])

    const categories: AddressCategory[] = [
      {
        addresses: qiMiningAddresses,
        callback: this.handleQiWalletBalanceUpdate,
      },
      {
        addresses: quaiAddresses,
        callback: this.handleQuaiAddressAccess,
      },
    ]
    await this.subscribeToAddressAccesses(selectedNetwork, categories)
  }

  private async subscribeToAddressAccesses(
    network: NetworkInterface,
    categories: AddressCategory[]
  ): Promise<void> {
    const { webSocketProvider } = this.providerFactory.getProvidersForNetwork(
      network.chainID
    )

    if (!webSocketProvider)
      logger.error("WebSocketProvider for address access subscription not found")

    const subscribedAddresses =
      this.activeSubscriptions.get(network.chainID) ?? new Set<string>()
    this.activeSubscriptions.set(network.chainID, subscribedAddresses)

    const subscriptions: Promise<unknown>[] = []
    categories.forEach(({ addresses, callback }) => {
      addresses.forEach(({ address }) => {
        if (!subscribedAddresses.has(address)) {
          subscribedAddresses.add(address)
          subscriptions.push(
            Promise.resolve(
              webSocketProvider.on(
                { type: "block", address },
                async (blockHash: string) => {
                  await callback(network, address, blockHash)
                }
              )
            ).catch((error) => {
              subscribedAddresses.delete(address)
              logger.warn(
                `Failed to subscribe to address accesses for ${address} on chain ${network.chainID}`,
                error
              )
            })
          )
        }
      })
    })
    await Promise.all(subscriptions)
  }

  public async subscribeToQiAddresses(existingWallet?: QiHDWallet): Promise<void> {
    const { selectedNetwork } = this
    // Use provided wallet or fetch from keyring (avoid redundant deserialization)
    const qiWallet = existingWallet ?? await this.keyringService.getQiHDWallet()
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
        callback: this.handleQiWalletBalanceUpdate,
      },
    ]
    await this.subscribeToAddressAccesses(selectedNetwork, categories)
  }

  private async handleQuaiAddressAccess(
    network: NetworkInterface,
    address: string,
    blockHash: string
  ): Promise<void> {
    const accessKey = this.getAddressAccessKey(network, address, blockHash)
    if (this.processedAddressAccesses.has(accessKey)) return

    const cleanupTimer = setTimeout(() => {
      this.processedAddressAccesses.delete(accessKey)
    }, MINUTE)
    this.processedAddressAccesses.set(accessKey, cleanupTimer)

    // Capture the previous store value before the refresh emits its update so
    // incoming-asset notifications compare against the actual prior balance.
    const selectedAccount = await this.preferenceService.getSelectedAccount()
    const currentAccountState =
      globalThis.main.store.getState().account.accountsData.evm[
        selectedAccount.network.chainID
      ]?.[selectedAccount.address]
    const currentNetworkChainID = selectedAccount.network.chainID
    const currentBalanceAmount =
      currentAccountState === "loading"
        ? undefined
        : currentAccountState?.balances["QUAI"].assetAmount.amount

    // Access notifications are authoritative freshness signals. Start one
    // forced refresh before notifying transaction listeners so their terminal
    // refresh can join this request instead of duplicating it.
    const balanceRequest = this.getLatestBaseAccountBalance(
      { address, network },
      { force: true }
    )

    this.emitter
      .emit("addressAccessed", { address, blockHash, network })
      .catch((error) =>
        logger.warn(`Failed to process address access for ${address}`, error)
      )

    const accountBalance = await balanceRequest
    const {
      assetAmount: { asset, amount: balance },
    } = accountBalance

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
  }

  private getAddressAccessKey(
    network: NetworkInterface,
    address: string,
    blockHash: string
  ): string {
    return `${network.chainID}:${blockHash.toLowerCase()}:${address.toLowerCase()}`
  }

  async refreshBaseAccountBalanceAfterTransaction(
    addressOnNetwork: AddressOnNetwork,
    blockHash?: string | null
  ): Promise<AccountBalance> {
    const refreshedFromAccess =
      !!blockHash &&
      this.processedAddressAccesses.has(
        this.getAddressAccessKey(
          addressOnNetwork.network,
          addressOnNetwork.address,
          blockHash
        )
      )

    // If the matching access event was missed, force the HTTP fallback refresh
    // even when an unrelated recent poll populated the cache.
    return this.getLatestBaseAccountBalance(addressOnNetwork, {
      force: !refreshedFromAccess,
    })
  }

  private async handleQiWalletBalanceUpdate(): Promise<void> {
    if (this.qiWalletBalanceSyncTimer) {
      clearTimeout(this.qiWalletBalanceSyncTimer)
    }

    this.qiWalletBalanceSyncTimer = setTimeout(() => {
      this.qiWalletBalanceSyncTimer = null
      this.syncQiWallet({ requireFreshScan: true }).catch((error) => {
        logger.error("Failed to sync Qi wallet after balance event", error)
      })
    }, 500)
  }

  private isNetworkSubscribed(network: NetworkInterface): boolean {
    return this.activeSubscriptions.has(network.chainID)
  }

  public async onNewQiAccountCreated(
    qiCoinbaseAddress: QiCoinbaseAddress
  ): Promise<void> {
    await this.subscribeToAddressAccesses(this.selectedNetwork, [
      {
        addresses: [qiCoinbaseAddress],
        callback: this.handleQiWalletBalanceUpdate,
      },
    ])
  }

  public async onNewAccountCreated(
    network: NetworkInterface,
    newAccount: AddressOnNetwork
  ): Promise<void> {
    const subscribedAccountsOnNetwork = this.activeSubscriptions.get(
      network.chainID
    )

    if (subscribedAccountsOnNetwork) {
      await this.subscribeToAddressAccesses(network, [
        {
          addresses: [newAccount],
          callback: this.handleQuaiAddressAccess,
        },
      ])

      return
    }

    const provider = this.providerFactory.getProvidersForNetwork(
      network.chainID
    )

    if (provider) {
      const accounts = await this.getTrackedAddressesOnNetwork(network)

      await this.subscribeToAddressAccesses(network, [
        {
          addresses: accounts,
          callback: this.handleQuaiAddressAccess,
        },
      ])
    }
  }

  private subscribeOnNetworksAndAddresses = async (
    networks: NetworkInterface[],
    accounts: AddressOnNetwork[]
  ): Promise<void> => {
    await Promise.all(
      networks.map(async (network) => {
        await Promise.allSettled([
          this.trackSubscribedNetwork(network),
          this.emitter.emit("networkSubscribed", network),
        ])

        await Promise.allSettled(
          accounts
            .filter((account) => account.network.chainID === network.chainID)
            .map((account) => this.addAccountToTrack(account))
        )
      })
    )
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
    [address: string]: OutpointInfo[]
  }): Promise<void> {
    // Flatten the outpoints array and map each outpoint to include its address
    const qiOutpoints = Object.entries(outpoints).flatMap(
      ([address, outpointInfos]) =>
        outpointInfos.map((outpointInfo) => ({
          outpoint: outpointInfo.outpoint,
          address,
          chainID: this.selectedNetwork.chainID,
          value: denominations[outpointInfo.outpoint.denomination],
          derivationPath: outpointInfo.derivationPath,
        }))
    )

    await this.db.addQiOutpoints(qiOutpoints)
  }

  private async handleOutpointsDeleted(outpoints: {
    [address: string]: OutpointInfo[]
  }): Promise<void> {
    // Flatten the outpoints array and map each outpoint to include its address
    const qiOutpoints = Object.entries(outpoints).flatMap(
      ([address, outpointInfos]) =>
        outpointInfos.map((outpointInfo) => ({
          outpoint: outpointInfo.outpoint,
          address,
          chainID: this.selectedNetwork.chainID,
          value: denominations[outpointInfo.outpoint.denomination],
          derivationPath: outpointInfo.derivationPath,
        }))
    )
    await this.db.removeQiOutpoints(qiOutpoints)
  }

  syncQiWallet({
    forceFullScan: forceFullScan_ = false,
    ignoreRecentSync = false,
    requireFreshScan = false,
  }: QiWalletSyncOptions = {}): Promise<void> {
    // Alarm and subscription callbacks can fire while the extension is
    // locked (including immediately after a service-worker restart). A Qi
    // sync requires the decrypted wallet and eventually persists its updated
    // state, so do not mutate sync metadata or outpoints unless the vault key
    // is available.
    if (this.keyringService.isLocked()) {
      logger.debug("[syncQiWallet] Skipping sync while keyring is locked")
      return Promise.resolve()
    }

    const effectiveIgnoreRecentSync = ignoreRecentSync || requireFreshScan

    if (this.qiWalletSyncPromise) {
      if (requireFreshScan) {
        return this.queueQiWalletSyncAfterActive({
          forceFullScan: forceFullScan_,
          ignoreRecentSync: true,
        })
      }

      const activeSyncSatisfiesRequest =
        (!forceFullScan_ || this.qiWalletSyncOptions?.forceFullScan) &&
        (!effectiveIgnoreRecentSync ||
          this.qiWalletSyncOptions?.ignoreRecentSync ||
          this.qiWalletSyncOptions?.forceFullScan)

      return activeSyncSatisfiesRequest
        ? this.qiWalletSyncPromise
        : this.queueQiWalletSyncAfterActive({
            forceFullScan: forceFullScan_,
            ignoreRecentSync: effectiveIgnoreRecentSync,
          })
    }

    if (this.qiWalletSyncInProgress) {
      return requireFreshScan
        ? this.queueQiWalletSyncAfterActive({
            forceFullScan: forceFullScan_,
            ignoreRecentSync: true,
          })
        : Promise.resolve()
    }

    this.qiWalletSyncInProgress = true
    this.qiWalletSyncOptions = {
      forceFullScan: forceFullScan_,
      ignoreRecentSync: effectiveIgnoreRecentSync,
    }
    main.store.dispatch(setQiWalletSyncInProgress(true))

    const syncPromise = (async () => {
      try {
        const network = this.selectedNetwork

        const [lastScan, lastSync] = await Promise.all([
          this.db.getQiLastFullScan(network.chainID),
          this.db.getQiLastSync(network.chainID),
        ])

        // Force full scan if:
        // 1. No previous scan exists
        // 2. Version mismatch
        // 3. Explicitly requested
        // 4. More than 1 hour since last successful scan or sync
        const ONE_HOUR_MS = 60 * 60 * 1000
        const now = Date.now()
        const lastSyncTimestamp = Math.max(
          lastScan?.timestamp || 0,
          lastSync?.timestamp || 0
        )
        const timeSinceLastSync = now - lastSyncTimestamp
        const isStale = lastSyncTimestamp > 0 && timeSinceLastSync > ONE_HOUR_MS

        if (
          !forceFullScan_ &&
          !effectiveIgnoreRecentSync &&
          lastSyncTimestamp > 0 &&
          timeSinceLastSync < MINUTE
        ) {
          logger.debug(
            `[syncQiWallet] Skipping sync completed ${(
              timeSinceLastSync / 1000
            ).toFixed(1)}s ago`
          )
          return
        }

        const forceFullScan =
          !lastScan ||
          lastScan.version !== currentVersion ||
          forceFullScan_ ||
          isStale

        if (forceFullScan) {
          // Clear outpoints and sync info for fresh scan
          await this.db.clearQiOutpoints()
          await this.db.clearQiWalletSyncInfo()
        }

        const qiWallet = await this.keyringService.getQiHDWallet()

        if (!qiWallet) {
          // it's possible that the wallet does not exist (quai private key was imported)
          // or the wallet has not been initialized yet after wallet creation/restoration
          return
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
        let spendableBalance = 0n
        let lockedBalance = 0n

        if (forceFullScan) {
          // use immediateJsonRpcProvider to avoid race condition
          qiWallet.connect(this.immediateJsonRpcProvider)

          await qiWallet.scan(Zone.Cyprus1, 0)

          // switch back to jsonRpcProvider
          qiWallet.connect(this.jsonRpcProvider)
          storeOutpoints = true

          // calculate spendable balance for the current block using in memory outpoints
          spendableBalance = await qiWallet.getSpendableBalance(
            Zone.Cyprus1,
            currentBlock?.woHeader.number,
            true
          )
          lockedBalance = await qiWallet.getLockedBalance(
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
            qiWallet.getSpendableBalance(
              Zone.Cyprus1,
              currentBlock?.woHeader.number,
              false
            ),
            qiWallet.getLockedBalance(
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
          this.subscribeToQiAddresses(qiWallet),
          this.db.addQiLedgerBalance(qiWalletBalance),
          new Promise<void>(async (resolve): Promise<void> => {
            if (storeOutpoints) {
              const outpoints = qiWallet.getOutpoints(Zone.Cyprus1)
              const qiOutpoints = outpoints.map((outpointInfo) => ({
                outpoint: outpointInfo.outpoint,
                address: outpointInfo.address,
                chainID: network.chainID,
                value: denominations[outpointInfo.outpoint.denomination],
                derivationPath: outpointInfo.derivationPath,
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
                currentBlock?.hash!,
                currentVersion
              )
            } else {
              await this.db.setQiLastSync(
                this.selectedNetwork.chainID,
                currentBlock?.woHeader.number!,
                currentBlock?.hash!,
                currentVersion
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
      }
    })()

    const trackedSyncPromise = syncPromise.finally(() => {
      if (this.qiWalletSyncPromise === trackedSyncPromise) {
        this.qiWalletSyncPromise = null
        this.qiWalletSyncOptions = null
        this.qiWalletSyncInProgress = false
        main.store.dispatch(setQiWalletSyncInProgress(false))
      }
    })
    this.qiWalletSyncPromise = trackedSyncPromise
    return trackedSyncPromise
  }

  private queueQiWalletSyncAfterActive(
    options: QiWalletSyncOptions
  ): Promise<void> {
    this.queuedQiWalletSyncOptions = {
      forceFullScan:
        this.queuedQiWalletSyncOptions?.forceFullScan ||
        options.forceFullScan,
      ignoreRecentSync:
        this.queuedQiWalletSyncOptions?.ignoreRecentSync ||
        options.ignoreRecentSync ||
        options.requireFreshScan,
    }

    if (this.queuedQiWalletSyncPromise) {
      return this.queuedQiWalletSyncPromise
    }

    const activeSync = this.qiWalletSyncPromise
    if (!activeSync) {
      const queuedOptions = this.queuedQiWalletSyncOptions
      this.queuedQiWalletSyncOptions = null
      return this.syncQiWallet(queuedOptions ?? {})
    }

    let queuedPromise: Promise<void>
    const runQueuedSync = () => {
      const queuedOptions = this.queuedQiWalletSyncOptions
      this.queuedQiWalletSyncOptions = null
      if (this.queuedQiWalletSyncPromise === queuedPromise) {
        this.queuedQiWalletSyncPromise = null
      }
      return this.syncQiWallet(queuedOptions ?? {})
    }
    queuedPromise = activeSync.then(runQueuedSync, runQueuedSync)
    this.queuedQiWalletSyncPromise = queuedPromise
    return queuedPromise
  }

  async deepScanQiWallet(extraAddresses: number = 100): Promise<void> {
    if (this.qiWalletSyncInProgress) {
      logger.info("Deep scan skipped - sync already in progress")
      return
    }

    this.qiWalletSyncInProgress = true
    let finishDeepScan: () => void = () => undefined
    const deepScanPromise = new Promise<void>((resolve) => {
      finishDeepScan = resolve
    })
    this.qiWalletSyncPromise = deepScanPromise
    this.qiWalletSyncOptions = {
      forceFullScan: true,
      ignoreRecentSync: true,
    }
    main.store.dispatch(setQiWalletSyncInProgress(true))

    try {
      const network = this.selectedNetwork

      // Fetch current block FIRST so we can bail early without touching DB state
      // if the RPC is unreachable
      const currentBlock = await this.jsonRpcProvider.getBlock(Shard.Cyprus1, "latest")
      if (!currentBlock?.hash || currentBlock.woHeader?.number === undefined) {
        logger.error("[deepScan] Failed to fetch current block — aborting")
        return
      }
      const currentBlockNumber = currentBlock.woHeader.number
      const currentBlockHash = currentBlock.hash

      const qiWallet = await this.keyringService.getQiHDWallet()
      if (!qiWallet) {
        return
      }

      // Clear existing outpoints for a fresh deep scan
      await this.db.clearQiOutpoints()
      await this.db.clearQiWalletSyncInfo()

      // Open payment channels from mailbox
      const paymentCode = qiWallet.getPaymentCode(0)
      try {
        const mailboxContract = new Contract(
          MAILBOX_CONTRACT_ADDRESS || "",
          MAILBOX_INTERFACE,
          this.jsonRpcProvider
        )
        const notifications = await mailboxContract.getNotifications(paymentCode)
        notifications.forEach((pc: string) => qiWallet.openChannel(pc))
      } catch (error: any) {
        logger.error(`[deepScan] Error getting mailbox notifications: ${error?.message}`)
      }

      qiWallet.connect(this.immediateJsonRpcProvider)
      await (qiWallet as any).deepScan(Zone.Cyprus1, 0, extraAddresses)

      qiWallet.connect(this.jsonRpcProvider)

      // Get balance using the block we fetched upfront
      const spendableBalance = await qiWallet.getSpendableBalance(
        Zone.Cyprus1,
        currentBlockNumber,
        true
      )
      const lockedBalance = await qiWallet.getLockedBalance(
        Zone.Cyprus1,
        currentBlockNumber,
        true
      )

      // Store outpoints
      const outpoints = qiWallet.getOutpoints(Zone.Cyprus1)
      const qiOutpoints = outpoints.map((outpointInfo) => ({
        outpoint: outpointInfo.outpoint,
        address: outpointInfo.address,
        chainID: network.chainID,
        value: denominations[outpointInfo.outpoint.denomination],
        derivationPath: outpointInfo.derivationPath,
      }))
      await this.db.addQiOutpoints(qiOutpoints)

      // Update balance
      const qiWalletBalance: QiWalletBalance = {
        paymentCode,
        network,
        assetAmount: { asset: QI, amount: spendableBalance },
        lockedAmount: { asset: QI, amount: lockedBalance },
        dataSource: "local",
        retrievedAt: Date.now(),
      }
      this.emitter.emit("updatedQiLedgerBalance", {
        balances: [qiWalletBalance],
        addressOnNetwork: { paymentCode, network },
      })
      await this.db.addQiLedgerBalance(qiWalletBalance)

      // Update scan info
      await this.db.setQiLastFullScan(
        network.chainID,
        currentBlockNumber,
        currentBlockHash,
        currentVersion
      )

      // Save wallet state (preserves deep scan addresses in serialized wallet)
      const serializedQiWallet = { qiHDWallet: qiWallet.serialize() }
      await this.keyringService.vaultManager.add(serializedQiWallet, {})
    } catch (error: any) {
      logger.error("[deepScan] Error:", error.message)
    } finally {
      if (this.qiWalletSyncPromise === deepScanPromise) {
        this.qiWalletSyncPromise = null
        this.qiWalletSyncOptions = null
        this.qiWalletSyncInProgress = false
        main.store.dispatch(setQiWalletSyncInProgress(false))
      }
      finishDeepScan()
    }
  }

  async getOutpointsForQiAddress(address: string): Promise<Outpoint[]> {
    return this.jsonRpcProvider.getOutpointsByAddress(address)
  }

  /**
   * Get the last persisted Qi balance from IndexedDB.
   * Used to show cached balance immediately on unlock while sync runs in background.
   */
  async getCachedQiBalance(): Promise<QiWalletBalance | null> {
    return this.db.getLatestQiLedgerBalance(this.selectedNetwork)
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

  async getQiOutpointsLessThanDenomination(denomination: number, chainID: string, currentBlockNumber: number): Promise<QiOutpoint[]> {
    return this.db.getUnlockedQiOutpointsLessThanDenomination(denomination, chainID, currentBlockNumber)
  }

  async removeQiOutpoints(outpoints: QiOutpoint[]): Promise<void> {
    return this.db.removeQiOutpoints(outpoints)
  }

  async getLatestBaseAccountBalance(
    { address, network }: AddressOnNetwork,
    { force = false, maxAgeMs = MINUTE }: BaseBalanceRefreshOptions = {}
  ): Promise<AccountBalance> {
    const requestKey = `${network.chainID}:${address.toLowerCase()}`
    const existing = this.baseBalanceRequests.get(requestKey)
    if (existing && (!force || existing.force)) return existing.request

    const request = (async () => {
      if (existing) {
        try {
          await existing.request
        } catch {
          // A forced refresh must still run after a weaker request fails.
        }
      }
      return this.getCachedOrFetchBaseAccountBalance(
        { address, network },
        force,
        maxAgeMs
      )
    })()
    const entry = { force, request }
    this.baseBalanceRequests.set(requestKey, entry)

    try {
      return await request
    } finally {
      if (this.baseBalanceRequests.get(requestKey) === entry) {
        this.baseBalanceRequests.delete(requestKey)
      }
    }
  }

  private async getCachedOrFetchBaseAccountBalance(
    addressOnNetwork: AddressOnNetwork,
    force: boolean,
    maxAgeMs: number
  ): Promise<AccountBalance> {
    const { address, network } = addressOnNetwork

    if (!force) {
      const asset = await this.db.getBaseAssetForNetwork(network.chainID)
      const cachedBalance = await this.db.getLatestAccountBalance(
        address,
        network,
        asset
      )

      if (cachedBalance && Date.now() - cachedBalance.retrievedAt < maxAgeMs) {
        await this.publishTrackedAccountBalance(cachedBalance)
        return cachedBalance
      }
    }

    return this.fetchLatestBaseAccountBalance(addressOnNetwork)
  }

  private async publishTrackedAccountBalance(
    accountBalance: AccountBalance
  ): Promise<boolean> {
    const trackedAccounts = await this.getAccountsToTrack()
    const isTracked = trackedAccounts.some(
      ({ address, network }) =>
        sameQuaiAddress(address, accountBalance.address) &&
        network.chainID === accountBalance.network.chainID
    )

    if (!isTracked) return false

    this.emitter.emit("accountsWithBalances", {
      balances: [accountBalance],
      addressOnNetwork: {
        address: accountBalance.address,
        network: accountBalance.network,
      },
    })
    return true
  }

  private async fetchLatestBaseAccountBalance({
    address,
    network,
  }: AddressOnNetwork): Promise<AccountBalance> {
    const provider = this.getJsonRpcProviderForNetwork(network.chainID)
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
        provider.getBalance(address, "latest"),
        provider.getLockedBalance(address),
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

    // Don't emit or save if the account isn't tracked.
    if (await this.publishTrackedAccountBalance(accountBalance)) {
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

  private isCurrentlyActiveChainID(chainID: string): boolean {
    return Date.now() < globalThis.main.store.getState().ui.lastUserActivityOnNetwork[chainID] + NETWORK_POLLING_TIMEOUT
  }

  private isCurrentlyActiveAddress(address: HexString): boolean {
    return Date.now() < globalThis.main.store.getState().ui.lastUserActivityOnAddress[address] + NETWORK_POLLING_TIMEOUT
  }

  /**
   * Check for any incoming or outgoing asset transfers involving tracked accounts.
   */
  private async handleRecentAssetTransferAlarm(): Promise<void> {
    const accountsToTrack = await this.getAccountsToTrack()

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
   * Record a network initialized by this service.
   *
   * @param network The initialized network.
   */
  private async trackSubscribedNetwork(
    network: NetworkInterface
  ): Promise<void> {
    const { jsonRpcProvider, subscribedNetworks } = this

    if (!jsonRpcProvider) throw new Error("Failed to track initialized network")

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
