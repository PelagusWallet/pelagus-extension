/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */
/* eslint-disable import/no-cycle */
import {
  getZoneForAddress,
  JsonRpcProvider,
  QuaiTransaction,
  Shard,
  toBigInt,
  TransactionReceipt,
  TransactionResponse,
  WebSocketProvider,
  Zone,
} from "quais"
import {
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import { NetworksArray } from "../../constants/networks/networks"
import ProviderFactory from "../provider-factory/provider-factory"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import logger from "../../lib/logger"
import getBlockPrices from "../../lib/gas"
import { HexString, UNIXTime } from "../../types"
import { AccountBalance, AddressOnNetwork } from "../../accounts"
import { AnyEVMBlock, BlockPrices, toHexChainID } from "../../networks"
import {
  AnyAssetAmount,
  AssetTransfer,
  SmartContractFungibleAsset,
} from "../../assets"
import { HOUR, MINUTE, SECOND } from "../../constants"
import PreferenceService from "../preferences"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import { ChainDatabase, createDB, QuaiTransactionDBEntry } from "./db"
import BaseService from "../base"
import {
  blockFromProviderBlock,
  getExtendedZoneForAddress,
  getNetworkById,
} from "./utils"
import { sameQuaiAddress } from "../../lib/utils"
import AssetDataHelper from "./utils/asset-data-helper"
import KeyringService from "../keyring"
import type { ValidatedAddEthereumChainParameter } from "../provider-bridge/utils"
import { getRelevantTransactionAddresses } from "../enrichment/utils"
import {
  createConfirmedQuaiTransaction,
  createFailedQuaiTransaction,
  createPendingQuaiTransaction,
  createSerializedQuaiTransaction,
} from "./utils/quai-transactions"
import {
  PendingQuaiTransaction,
  QuaiTransactionState,
  QuaiTransactionStatus,
  SerializedTransactionForHistory,
} from "./types"

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

// The number of milliseconds after a request to look up a transaction was
// first seen to continue looking in case the transaction fails to be found
// for either internal (request failure) or external (transaction dropped from
// mempool) reasons.
const TRANSACTION_CHECK_LIFETIME_MS = 10 * HOUR

const GAS_POLLS_PER_PERIOD = 1 // 1 time per 5 minutes
const GAS_POLLING_PERIOD = 5 // 5 minutes

// Maximum number of transactions with priority.
// Transactions that will be retrieved before others for one account.
// Transactions with priority for individual accounts will keep the order of loading
// from adding accounts.
const TRANSACTIONS_WITH_PRIORITY_MAX_COUNT = 25

interface Events extends ServiceLifecycleEvents {
  initializeActivities: {
    transactions: SerializedTransactionForHistory[]
    accounts: AddressOnNetwork[]
  }
  initializeActivitiesForAccount: {
    transactions: SerializedTransactionForHistory[]
    account: AddressOnNetwork
  }
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
  transactionSend: HexString
  networkSubscribed: NetworkInterface
  transactionSendFailure: undefined
  assetTransfers: {
    addressNetwork: AddressOnNetwork
    assetTransfers: AssetTransfer[]
  }
  block: AnyEVMBlock
  transaction: {
    forAccounts: string[]
    transaction: SerializedTransactionForHistory
  }
  blockPrices: { blockPrices: BlockPrices; network: NetworkInterface }
  customChainAdded: ValidatedAddEthereumChainParameter
}

export type QueuedTxToRetrieve = {
  network: NetworkInterface
  hash: HexString
  firstSeen: UNIXTime
}
/**
 * The queue object contains transaction and priority.
 * The priority value is a number. The value of the highest priority has not been set.
 * The lowest possible priority is 0.
 */
export type PriorityQueuedTxToRetrieve = {
  transaction: QueuedTxToRetrieve
  priority: number
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

  public supportedNetworks = NetworksArray

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
  } = Object.fromEntries(NetworksArray.map((network) => [network.chainID, 0]))

  private lastUserActivityOnAddress: {
    [address: HexString]: UNIXTime
  } = {}

  /**
   * Modified FIFO queues with priority of transaction hashes per network that should be retrieved and
   * cached, alongside information about when that hash request was first seen
   * for expiration purposes. In the absence of priorities, it acts as a regular FIFO queue.
   */
  private transactionsToRetrieve: PriorityQueuedTxToRetrieve[]

  /**
   * Internal timer for the transactionsToRetrieve FIFO queue.
   * Starting multiple transaction requests at the same time is resource intensive
   * on the user's machine and also can result in rate limitations with the provider.
   *
   * Because of this we need to smooth out the retrieval scheduling.
   *
   * Limitations
   *   - handlers can fire only in 1+ minute intervals
   *   - in manifest v3 / service worker context the background thread can be shut down any time.
   *     Because of this we need to keep the granular queue tied to the persisted list of txs
   */
  private transactionToRetrieveGranularTimer: NodeJS.Timer | undefined

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
      createDB(),
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
      queuedTransactions: {
        schedule: {
          delayInMinutes: 1,
          periodInMinutes: 1,
        },
        handler: () => {
          this.handleQueuedTransactionAlarm()
        },
      },
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
      blockPrices: {
        runAtStart: false,
        schedule: {
          periodInMinutes: GAS_POLLING_PERIOD,
        },
        handler: () => {
          this.pollBlockPrices()
        },
      },
    })

    this.subscribedAccounts = []
    this.subscribedNetworks = []
    this.transactionsToRetrieve = []
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

    this.assetData = new AssetDataHelper(jsonRpcProvider)

    const accounts = await this.getAccountsToTrack()
    const transactions = await this.db.getAllQuaiTransactions()
    await this.emitter.emit("initializeActivities", {
      transactions,
      accounts,
    })

    this.emitter.emit("supportedNetworks", NetworksArray)

    await this.subscribeOnAccountTransactions(this.supportedNetworks, accounts)
    await this.subscribeOnNetworksAndAddresses(this.supportedNetworks, accounts)
  }

  public switchNetwork(network: NetworkInterface): void {
    const { jsonRpcProvider, webSocketProvider } =
      this.providerFactory.getProvidersForNetwork(network.chainID)

    this.jsonRpcProvider = jsonRpcProvider
    this.webSocketProvider = webSocketProvider

    this.subscribedAccounts.map((item) =>
      this.getLatestBaseAccountBalance({ address: item.account, network })
    )
  }

  // --------------------------------------------------------------------------------------------------

  private subscribeOnNetworksAndAddresses = async (
    networks: NetworkInterface[],
    accounts: AddressOnNetwork[]
  ): Promise<void> => {
    networks.forEach((network) => {
      Promise.allSettled([
        this.pollLatestBlock(network),
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

  private subscribeOnAccountTransactions = async (
    networks: NetworkInterface[],
    accounts: AddressOnNetwork[]
  ): Promise<void> => {
    networks.forEach((network) => {
      Promise.allSettled([
        this.db
          .getQuaiTransactionsByStatus(network, QuaiTransactionStatus.PENDING)
          .then((pendingTransactions) => {
            pendingTransactions.forEach(({ hash, firstSeen }) => {
              if (!hash)
                throw new Error("Failed subscribe on account transactions")
              logger.debug(
                `Queuing pending transaction ${hash} for status lookup.`
              )
              this.queueTransactionHashToRetrieve(network, hash, firstSeen)
            })
          }),
      ]).catch((e) => logger.error(e))

      accounts.forEach(async (account) => {
        Promise.allSettled([
          this.subscribeToAccountTransactions(account),
          this.getLatestBaseAccountBalance(account),
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

  async removeActivities(address: string): Promise<void> {
    await this.db.deleteQuaiTransactionsByAddress(address)
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
      balance = await this.jsonRpcProvider.getBalance(address, "latest")
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error getting balance for address", address, error)
        err = true // only reset user-displayed error if there's no error at all
        if (error.message.includes("could not detect network")) {
          globalThis.main.SetNetworkError({
            chainId: network.chainID,
            error: true,
          })
        }
        console.error(
          `Global shard: ${
            globalThis.main.SelectedShard
          } Address shard: ${addrShard} Provider: ${
            this.jsonRpcProvider._getConnection().url
          }`
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
    const source = this.keyringService.getQuaiHDWalletSourceForAddress(
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
    }
    this.emitSavedTransactions(addressNetwork)

    this.subscribeToAccountTransactions(addressNetwork).catch((e) => {
      logger.error(
        "chainService/addAccountToTrack: Error subscribing to account transactions",
        e
      )
    })

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

  // ----------------------------------------- BLOCKS -------------------------------------------------
  async getBlockHeight(network: NetworkInterface): Promise<number> {
    try {
      const cachedBlock = await this.db.getLatestBlock(network)
      const { address } = await this.preferenceService.getSelectedAccount()
      const shard = getExtendedZoneForAddress(address, false) as Shard

      if (cachedBlock) return cachedBlock.blockHeight

      const blockNumber = await this.jsonRpcProvider.getBlockNumber(shard)

      return blockNumber
    } catch (e) {
      console.error(e)
      throw new Error("Failed get block number")
    }
  }

  /**
   * Polls the latest block number from the blockchain, saves it into the database,
   * and emits a block event.
   *
   * @param {NetworkInterface} network - The network interface to use for polling the block.
   */
  private async pollLatestBlock(network: NetworkInterface): Promise<void> {
    try {
      const { address } = await this.preferenceService.getSelectedAccount()

      const shard = getExtendedZoneForAddress(address, false) as Shard

      const latestBlock = await this.jsonRpcProvider.getBlock(shard, "latest")
      if (!latestBlock) return

      const block = blockFromProviderBlock(network, latestBlock)
      await this.db.addBlock(block)

      this.emitter.emit("block", block)

      // TODO if it matches a known block height and the difficulty is higher,
      // emit a reorg event
    } catch (e) {
      logger.error("Error getting block number", e)
    }
  }

  /**
   * Return cached information on a block if it's in the local DB.
   *
   * If the block is not cached, retrieve it from the specified shard,
   * cache it in the local DB, and return the block object.
   *
   * @param network - The EVM network we're interested in.
   * @param shard - The shard from which to retrieve the block.
   * @param blockHash - The hash of the block we're interested in.
   * @returns {Promise<AnyEVMBlock>} - The block object, either from cache or from the network.
   * @throws {Error} - If the block cannot be retrieved from the network.
   */
  async getBlockByHash(
    network: NetworkInterface,
    shard: Shard,
    blockHash: string
  ): Promise<AnyEVMBlock> {
    try {
      const cachedBlock = await this.db.getBlock(network, blockHash)

      if (cachedBlock) return cachedBlock

      const resultBlock = await this.jsonRpcProvider.getBlock(shard, blockHash)
      if (!resultBlock) {
        throw new Error(`Failed to get block`)
      }

      const block = blockFromProviderBlock(network, resultBlock)
      await this.db.addBlock(block)

      this.emitter.emit("block", block)
      return block
    } catch (e) {
      console.error(e)
      throw new Error(`Failed to get block`)
    }
  }
  // ------------------------------------------------------------------------------------------------

  /**
   * Return cached information on a transaction, if it's both confirmed and
   * in the local DB.
   *
   * Otherwise, retrieve the transaction from the specified network, caching and
   * returning the object.
   *
   * @param txHash the hash of the unconfirmed transaction we're interested in
   */
  async getTransaction(
    txHash: HexString
  ): Promise<SerializedTransactionForHistory | QuaiTransactionDBEntry | null> {
    const cachedTx = await this.db.getQuaiTransactionByHash(txHash)
    return this.jsonRpcProvider
      .getTransaction(txHash)
      .then(async (tx) => {
        const transaction = tx as QuaiTransactionResponse | null

        if (!transaction) throw new Error("Failed to get transaction")

        const receipt = await this.jsonRpcProvider.getTransactionReceipt(txHash)

        if (!receipt || !transaction?.blockNumber) return cachedTx

        const confirmedQuaiTransaction = createConfirmedQuaiTransaction(
          transaction,
          receipt
        )

        await this.saveTransaction(confirmedQuaiTransaction, "local")

        return this.db.getQuaiTransactionByHash(confirmedQuaiTransaction?.hash)
      })
      .catch(async () => {
        if (!cachedTx) throw new Error("Failed to get transaction")
        return cachedTx
      })
  }

  async getTransactionFirstSeenFromDB(txHash: HexString): Promise<number> {
    return this.db.getQuaiTransactionFirstSeen(txHash)
  }

  /**
   * Queues up a particular transaction hash for later retrieval.
   *
   * Using this method means the service can decide when to retrieve a
   * particular transaction. Queued transactions are generally retrieved on a
   * periodic basis.
   *
   * @param network The network on which the transaction has been broadcast.
   * @param txHash The tx hash identifier of the transaction we want to retrieve.
   * @param firstSeen The timestamp at which the queued transaction was first
   *        seen; used to treat transactions as dropped after a certain amount
   *        of time.
   * @param priority The priority of the transaction in the queue to be retrieved
   */
  queueTransactionHashToRetrieve(
    network: NetworkInterface,
    txHash: HexString,
    firstSeen: UNIXTime,
    priority = 0
  ): void {
    const newElement: PriorityQueuedTxToRetrieve = {
      transaction: { hash: txHash, network, firstSeen },
      priority,
    }
    const seen = this.isTransactionHashQueued(network, txHash)
    if (!seen) {
      // @TODO Interleave initial transaction retrieval by network
      const existingTransactionIndex = this.transactionsToRetrieve.findIndex(
        ({ priority: txPriority }) => newElement.priority > txPriority
      )
      if (existingTransactionIndex >= 0) {
        this.transactionsToRetrieve.splice(
          existingTransactionIndex,
          0,
          newElement
        )
      } else {
        this.transactionsToRetrieve.push(newElement)
      }
    }
  }

  /**
   * Checks if a transaction with a given hash on a network is in the queue or not.
   *
   * @param txNetwork
   * @param txHash The hash of a tx to check.
   * @returns true if the tx hash is in the queue, false otherwise.
   */
  isTransactionHashQueued(
    txNetwork: NetworkInterface,
    txHash: HexString
  ): boolean {
    return this.transactionsToRetrieve.some(
      ({ transaction }) =>
        transaction.hash === txHash &&
        txNetwork.chainID === transaction.network.chainID
    )
  }

  /**
   * Removes a particular hash from our queue.
   *
   * @param network The network on which the transaction has been broadcast.
   * @param txHash The tx hash identifier of the transaction we want to retrieve.
   */
  removeTransactionHashFromQueue(
    network: NetworkInterface,
    txHash: HexString
  ): void {
    const seen = this.isTransactionHashQueued(network, txHash)

    if (seen) {
      // Let's clean up the tx queue if the hash is present.
      // The pending tx hash should be on chain as soon as it's broadcasted.
      this.transactionsToRetrieve = this.transactionsToRetrieve.filter(
        ({ transaction }) => transaction.hash !== txHash
      )
    }
  }

  /**
   * Estimate the gas needed to make a transaction. Adds 10% as a safety net to
   * the base estimate returned by the provider.
   */
  private async estimateGasPrice(tx: QuaiTransactionRequest): Promise<bigint> {
    const estimate = await this.jsonRpcProvider.estimateGas(tx)

    if (!estimate) throw new Error("Failed to estimate gas")
    // Add 10% more gas as a safety net
    return (estimate * 11n) / 10n
  }

  async signAndSendQuaiTransaction(
    request: QuaiTransactionRequest
  ): Promise<QuaiTransactionResponse | null> {
    try {
      const transactionResponse =
        await this.keyringService.signAndSendQuaiTransaction(request)

      const network = getNetworkById(transactionResponse?.chainId)

      if (!network) {
        throw new Error("Network is null.")
      }

      this.emitter.emit("transactionSend", transactionResponse.hash)

      const pendingQuaiTransaction = createPendingQuaiTransaction(
        transactionResponse as QuaiTransactionResponse
      )
      this.saveTransaction(pendingQuaiTransaction, "local")
      this.subscribeToTransactionConfirmation(network, pendingQuaiTransaction)

      return transactionResponse
    } catch (error) {
      logger.debug(
        "Broadcast error caught, saving failed status...",
        request,
        error
      )

      // TODO
      const temporary = request as QuaiTransactionResponse

      const failedTransaction = createFailedQuaiTransaction(temporary)
      this.saveTransaction(failedTransaction, "local")

      this.emitter.emit("transactionSendFailure")

      return null
    }
  }

  /**
   * Broadcast a signed EVM transaction.
   *
   * @param transaction A signed EVM transaction to broadcast. Since the tx is signed,
   *        it needs to include all gas limit and price params.
   */
  async broadcastSignedTransaction(
    transaction: QuaiTransaction
  ): Promise<void> {
    try {
      if (!transaction.to) {
        throw new Error("Transaction 'to' field is not specified.")
      }

      const zoneToBroadcast = getZoneForAddress(transaction.to)
      if (!zoneToBroadcast) {
        throw new Error(
          "Invalid address shard: Unable to determine the zone for the given 'to' address."
        )
      }

      const network = getNetworkById(transaction?.chainId)
      if (!network) {
        throw new Error("Network is null.")
      }

      const { serialized: signedTransaction } = transaction

      await Promise.all([
        this.jsonRpcProvider
          ?.broadcastTransaction(zoneToBroadcast, signedTransaction)
          .then((transactionResponse) => {
            this.emitter.emit("transactionSend", transactionResponse.hash)

            const pendingQuaiTransaction = createPendingQuaiTransaction(
              transactionResponse as QuaiTransactionResponse
            )
            this.saveTransaction(pendingQuaiTransaction, "local")
            this.subscribeToTransactionConfirmation(
              network,
              pendingQuaiTransaction
            )
          })
          .catch((error) => {
            logger.debug(
              "Broadcast error caught, saving failed status and releasing nonce...",
              transaction,
              error
            )

            const failedTransaction = createFailedQuaiTransaction(
              transaction,
              error.toString()
            )
            this.saveTransaction(failedTransaction, "local")
            return Promise.reject(error)
          }),
      ])
    } catch (error) {
      this.emitter.emit("transactionSendFailure")
      logger.error("Error broadcasting transaction", transaction, error)
      throw error
    }
  }

  async markAccountActivity({
    address,
    network,
  }: AddressOnNetwork): Promise<void> {
    const addressWasInactive = this.addressIsInactive(address)
    const networkWasInactive = this.networkIsInactive(network.chainID)
    this.markNetworkActivity(network.chainID)
    this.lastUserActivityOnAddress[address] = Date.now()
    if (addressWasInactive || networkWasInactive) {
      // Reactivating a potentially deactivated address
      this.loadRecentAssetTransfers({ address, network })
      this.getLatestBaseAccountBalance({ address, network })
    }
  }

  async markNetworkActivity(chainID: string): Promise<void> {
    const networkWasInactive = this.networkIsInactive(chainID)
    this.lastUserActivityOnNetwork[chainID] = Date.now()
    if (networkWasInactive) {
      this.pollBlockPricesForNetwork(chainID)
    }
  }

  addressIsInactive(address: string): boolean {
    return (
      Date.now() - NETWORK_POLLING_TIMEOUT >
      this.lastUserActivityOnAddress[address]
    )
  }

  networkIsInactive(chainID: string): boolean {
    return (
      Date.now() - NETWORK_POLLING_TIMEOUT >
      this.lastUserActivityOnNetwork[chainID]
    )
  }

  /*
   * Periodically fetch block prices and emit an event whenever new data is received
   * Write block prices to IndexedDB, so we have them for later
   */
  async pollBlockPrices(): Promise<void> {
    // Schedule next N polls at even interval
    for (let i = 1; i < GAS_POLLS_PER_PERIOD; i += 1) {
      setTimeout(async () => {
        await Promise.allSettled(
          this.subscribedNetworks.map(async ({ network }) =>
            this.pollBlockPricesForNetwork(network.chainID)
          )
        )
      }, (GAS_POLLING_PERIOD / GAS_POLLS_PER_PERIOD) * (GAS_POLLING_PERIOD * MINUTE) * i)
    }

    // Immediately run the first poll
    await Promise.allSettled(
      this.subscribedNetworks.map(async ({ network }) =>
        this.pollBlockPricesForNetwork(network.chainID)
      )
    )
  }

  async pollBlockPricesForNetwork(chainID: string): Promise<void> {
    if (!this.isCurrentlyActiveChainID(chainID)) return

    const subscription = this.subscribedNetworks.find(
      ({ network }) => toHexChainID(network.chainID) === toHexChainID(chainID)
    )

    if (!subscription) {
      logger.warn(
        `Can't fetch block prices for unsubscribed chainID ${chainID}`
      )
      return
    }

    const { address } = await this.preferenceService.getSelectedAccount()
    const shard = getExtendedZoneForAddress(address, false) as Shard
    const zone = Zone.Cyprus1 // TODO-MIGRATION toZone function can not be imported from quais
    const blockPrices = await getBlockPrices(
      subscription.network,
      subscription.provider,
      shard,
      zone
    )
    this.emitter.emit("blockPrices", {
      blockPrices,
      network: subscription.network,
    })
  }

  async send(method: string, params: unknown[]): Promise<unknown> {
    return this.jsonRpcProvider.send(method, params)
  }

  /**
   * Retrieves a confirmed or unconfirmed transaction's details from chain.
   * If found, then returns the transaction result received from chain.
   * If the tx hash is not found on chain, then remove it from the lookup queue
   * and mark it as dropped in the db. This will filter and fix those situations
   * when our records differ from what the chain/mempool sees. This can happen in
   * case of unstable networking conditions.
   *
   * @param network
   * @param hash
   */
  async getOrCancelTransaction(
    network: NetworkInterface,
    hash: string
  ): Promise<TransactionResponse | null | undefined> {
    try {
      return await this.jsonRpcProvider.getTransaction(hash)
    } catch (e) {
      console.error(e)
      logger.warn(
        `Tx hash ${hash} is found in our local registry but not on chain.`
      )

      this.removeTransactionHashFromQueue(network, hash)
      await this.jsonRpcProvider.off(hash)

      const savedTx = await this.db.getQuaiTransactionByHash(hash)
      if (savedTx && savedTx.status === QuaiTransactionStatus.FAILED) {
        const failedTransaction = createFailedQuaiTransaction(
          savedTx,
          "Transaction was in our local db but was not found on chain."
        )
        // Let's see if we have the tx in the db, and if yes let's mark it as dropped.
        await this.saveTransaction(failedTransaction, "local")
      }
      return null
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
    const blockHeight =
      (await this.getBlockHeight(addressNetwork.network)) -
      BLOCKS_TO_SKIP_FOR_TRANSACTION_HISTORY
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
    const oldest =
      (await this.db.getOldestAccountAssetTransferLookup(addressNetwork)) ??
      BigInt(await this.getBlockHeight(addressNetwork.network))

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

    const firstSeen = Date.now()

    const savedTransactionHashes = new Set(
      await this.db.getAllQuaiTransactionHashes()
    )
    /// send all new tx hashes into a queue to retrieve + cache
    assetTransfers.forEach((a, idx) => {
      if (!savedTransactionHashes.has(a.txHash)) {
        this.queueTransactionHashToRetrieve(
          addressOnNetwork.network,
          a.txHash,
          firstSeen,
          idx <= TRANSACTIONS_WITH_PRIORITY_MAX_COUNT ? 0 : 1
        )
      }
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

  private async handleQueuedTransactionAlarm(): Promise<void> {
    if (
      !this.transactionToRetrieveGranularTimer &&
      this.transactionsToRetrieve.length
    ) {
      this.transactionToRetrieveGranularTimer = setInterval(() => {
        if (
          !this.transactionsToRetrieve.length &&
          this.transactionToRetrieveGranularTimer
        ) {
          // Clean up if we have a timer, but we don't have anything in the queue
          clearInterval(this.transactionToRetrieveGranularTimer)
          this.transactionToRetrieveGranularTimer = undefined
          return
        }

        // TODO: balance getting txs between networks
        const { transaction } = this.transactionsToRetrieve[0]
        this.removeTransactionHashFromQueue(
          transaction.network,
          transaction.hash
        )
        this.retrieveTransaction(transaction)
      }, 2 * SECOND)
    }
  }

  /**
   * Retrieve a confirmed or unconfirmed transaction's details, saving the
   * results. If the transaction is confirmed, triggers retrieval and storage
   * of transaction receipt information as well. If lookup fails, re-queues the
   * transaction for a future retry until a constant lifetime is exceeded, at
   * which point the transaction is marked as dropped unless it was
   * independently marked as successful.
   *
   * @param network the EVM network we're interested in
   * @param transaction the confirmed transaction we're interested in
   */
  private async retrieveTransaction({
    network,
    hash,
    firstSeen,
  }: QueuedTxToRetrieve): Promise<void> {
    try {
      const transactionResponse = (await this.getOrCancelTransaction(
        network,
        hash
      )) as QuaiTransactionResponse | null

      if (!transactionResponse)
        throw new Error(`Failed to get or cancel transaction`)

      const receipt = await this.jsonRpcProvider.getTransactionReceipt(hash)

      if (receipt && transactionResponse.blockNumber)
        await this.saveTransaction(
          createConfirmedQuaiTransaction(transactionResponse, receipt),
          "local"
        )
    } catch (error) {
      logger.error(`Error retrieving transaction ${hash}`, error)
      if (Date.now() <= firstSeen + TRANSACTION_CHECK_LIFETIME_MS) {
        this.queueTransactionHashToRetrieve(network, hash, firstSeen)
      } else {
        logger.warn(
          `Transaction ${hash} is too old to keep looking for it; treating ` +
            "it as expired."
        )

        this.db.getQuaiTransactionByHash(hash).then((existingTransaction) => {
          if (existingTransaction) {
            logger.debug(
              "Found existing transaction for expired lookup; marking as " +
                "failed if no other status exists."
            )
            const failedTransaction =
              createFailedQuaiTransaction(existingTransaction)

            this.saveTransaction(failedTransaction, "local")
          }
        })
      }
    }
  }

  /**
   * Save a transaction to the database and emit an event.
   *
   * @param transaction The transaction to save and emit. Uniqueness and
   *        ordering will be handled by the database.
   * @param dataSource Where the transaction was seen.
   */
  public async saveTransaction(
    transaction: QuaiTransactionState,
    dataSource: "local"
  ): Promise<void> {
    const network = getNetworkById(transaction?.chainId)
    if (!network) throw new Error("Failed find network before save transaction")

    let error: unknown = null
    const serializedTx = createSerializedQuaiTransaction(transaction)
    try {
      await this.db.addOrUpdateQuaiTransaction(serializedTx, dataSource)
    } catch (err) {
      error = err
      logger.error(`Error saving tx ${serializedTx}`, error)
    }
    try {
      let accounts = await this.getAccountsToTrack()

      if (!accounts.length) {
        await this.db.addAccountToTrack({
          address: transaction.from ?? "",
          network,
        })
        accounts = await this.getAccountsToTrack()
      }

      const forAccounts = getRelevantTransactionAddresses(transaction, accounts)

      await this.emitter.emit("transaction", {
        transaction: serializedTx,
        forAccounts,
      })
    } catch (err) {
      error = err
      logger.error(`Error emitting tx ${transaction}`, error)
    }
    if (error) {
      throw error
    }
  }

  async emitSavedTransactions(account: AddressOnNetwork): Promise<void> {
    const { address, network } = account
    const transactionsForNetwork = await this.db.getQuaiTransactionsByNetwork(
      network
    )

    const transactions = transactionsForNetwork.filter(
      (transaction) =>
        sameQuaiAddress(transaction.from, address) ||
        sameQuaiAddress(transaction.to, address)
    )

    await this.emitter.emit("initializeActivitiesForAccount", {
      transactions,
      account,
    })
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

    this.pollLatestBlock(network)
    this.pollBlockPrices()
  }

  /**
   * Watch logs for an account's transactions on a particular network.
   *
   * @param addressOnNetwork The network and address to watch.
   */
  private async subscribeToAccountTransactions({
    address,
    network,
  }: AddressOnNetwork): Promise<void> {
    const provider = this.jsonRpcProvider
    if (!provider) throw new Error("Failed to get provider")

    const zone = getZoneForAddress(address) ?? undefined
    await provider.on(
      "pending",
      async (transactionHash: string) => {
        try {
          const tx = (await this.getTransaction(
            transactionHash
          )) as PendingQuaiTransaction

          if (tx.status !== QuaiTransactionStatus.PENDING)
            throw new Error("tx status is not pending")

          await this.handlePendingTransaction(tx, network)
        } catch (innerError) {
          logger.error(
            `Error handling incoming pending transaction hash: ${transactionHash}`,
            innerError
          )
        }
      },
      zone
    )

    this.subscribedAccounts.push({
      account: address,
      provider,
    })
  }

  /**
   * Persists pending transactions and subscribes to their confirmation
   *
   * @param transaction The pending transaction
   * @param network
   */
  private async handlePendingTransaction(
    transaction: PendingQuaiTransaction,
    network: NetworkInterface
  ): Promise<void> {
    try {
      if (!network)
        throw new Error("Failed find network handlePendingTransaction")

      // If this is an EVM chain, we're tracking the from address's
      // nonce, and the pending transaction has a higher nonce, update our
      // view of it. This helps reduce the number of times when a
      // transaction submitted outside of this wallet causes this wallet to
      await this.saveTransaction(transaction, "local")

      // Wait for confirmation/receipt information.
      await this.subscribeToTransactionConfirmation(network, transaction)
    } catch (error) {
      logger.error(`Error saving tx: ${transaction}`, error)
    }
  }

  /**
   * Track a pending transaction's confirmation status, saving any updates to
   * the database and informing subscribers via the emitter.
   *
   * @param network the EVM network we're interested in
   * @param transaction the unconfirmed transaction we're interested in
   */
  private async subscribeToTransactionConfirmation(
    network: NetworkInterface,
    transaction: PendingQuaiTransaction
  ): Promise<void> {
    this.webSocketProvider.once(
      transaction.hash,
      (receipt: TransactionReceipt) => {
        const confirmedTransaction = createConfirmedQuaiTransaction(
          transaction,
          receipt
        )
        this.saveTransaction(confirmedTransaction, "local")
        this.removeTransactionHashFromQueue(network, transaction.hash)
      }
    )

    // Let's add the transaction to the queued lookup. If the transaction is dropped
    // because of wrong nonce on chain the event will never arrive.
    this.queueTransactionHashToRetrieve(network, transaction.hash, Date.now())
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
      asset,
      amount: balance.amount,
    }
  }
}
