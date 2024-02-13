import { TransactionReceipt, TransactionResponse } from "@quais/providers"
import { BigNumber, quais, utils } from "quais"
import { Logger, UnsignedTransaction } from "quais/lib/utils"
import logger from "../../lib/logger"
import getBlockPrices from "../../lib/gas"
import { HexString, NormalizedEVMAddress, UNIXTime } from "../../types"
import { AccountBalance, AddressOnNetwork } from "../../accounts"
import {
  AnyEVMBlock,
  AnyEVMTransaction,
  EIP1559TransactionRequest,
  EVMNetwork,
  BlockPrices,
  TransactionRequest,
  TransactionRequestWithNonce,
  SignedTransaction,
  toHexChainID,
  NetworkBaseAsset,
  sameChainID,
} from "../../networks"
import {
  AnyAssetAmount,
  AssetTransfer,
  SmartContractFungibleAsset,
} from "../../assets"
import {
  HOUR,
  ETHEREUM,
  OPTIMISM,
  NETWORK_BY_CHAIN_ID,
  MINUTE,
  CHAINS_WITH_MEMPOOL,
  EIP_1559_COMPLIANT_CHAIN_IDS,
  SECOND,
  setProviderForShard,
  getShardFromAddress,
  QUAI_NETWORK,
  getProviderForGivenShard,
} from "../../constants"
import { FeatureFlags, isEnabled } from "../../features"
import PreferenceService from "../preferences"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import { createDB, ChainDatabase, Transaction } from "./db"
import BaseService from "../base"
import {
  blockFromEthersBlock,
  blockFromProviderBlock,
  enrichTransactionWithReceipt,
  ethersTransactionFromSignedTransaction,
  transactionFromEthersTransaction,
  ethersTransactionFromTransactionRequest,
  unsignedTransactionFromEVMTransaction,
} from "./utils"
import { normalizeEVMAddress, sameEVMAddress } from "../../lib/utils"
import type {
  EnrichedEIP1559TransactionRequest,
  EnrichedEIP1559TransactionSignatureRequest,
  EnrichedEVMTransactionRequest,
  EnrichedEVMTransactionSignatureRequest,
  EnrichedLegacyTransactionRequest,
  EnrichedLegacyTransactionSignatureRequest,
} from "../enrichment"
import SerialFallbackProvider, {
  makeSerialFallbackProvider,
} from "./serial-fallback-provider"
import AssetDataHelper from "./asset-data-helper"
import {
  OPTIMISM_GAS_ORACLE_ABI,
  OPTIMISM_GAS_ORACLE_ADDRESS,
} from "./utils/optimismGasPriceOracle"
import KeyringService from "../keyring"
import type { ValidatedAddEthereumChainParameter } from "../provider-bridge/utils"
import { getRelevantTransactionAddresses } from "../enrichment/utils"

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
    transactions: Transaction[]
    accounts: AddressOnNetwork[]
  }
  initializeActivitiesForAccount: {
    transactions: Transaction[]
    account: AddressOnNetwork
  }
  newAccountToTrack: {
    addressOnNetwork: AddressOnNetwork
    source: "import" | "internal" | null
  }
  supportedNetworks: EVMNetwork[]
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
  networkSubscribed: EVMNetwork
  transactionSendFailure: undefined
  assetTransfers: {
    addressNetwork: AddressOnNetwork
    assetTransfers: AssetTransfer[]
  }
  block: AnyEVMBlock
  transaction: { forAccounts: string[]; transaction: AnyEVMTransaction }
  blockPrices: { blockPrices: BlockPrices; network: EVMNetwork }
  customChainAdded: ValidatedAddEthereumChainParameter
}

export type QueuedTxToRetrieve = {
  network: EVMNetwork
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
 * * ... and finally, polling and websocket providers for supported networks, in
 *   case a service needs to interact with a network directly.
 */
export default class ChainService extends BaseService<Events> {
  providers: { evm: { [networkName: string]: SerialFallbackProvider } } = {
    evm: {},
  }

  subscribedAccounts: {
    account: string
    provider: SerialFallbackProvider
  }[]

  subscribedNetworks: {
    network: EVMNetwork
    provider: SerialFallbackProvider
  }[]

  private lastUserActivityOnNetwork: {
    [chainID: string]: UNIXTime
  } = {}

  private lastUserActivityOnAddress: {
    [address: HexString]: UNIXTime
  } = {}

  /**
   * For each chain id, track an address's last seen nonce. The tracked nonce
   * should generally not be allocated to a new transaction, nor should any
   * nonces that precede it, unless the intent is deliberately to replace an
   * unconfirmed transaction sharing the same nonce.
   */
  private evmChainLastSeenNoncesByNormalizedAddress: {
    [chainID: string]: { [normalizedAddress: string]: number }
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
    [Promise<PreferenceService>, Promise<KeyringService>]
  > = async (preferenceService, keyringService) => {
    return new this(createDB(), await preferenceService, await keyringService)
  }

  supportedNetworks: EVMNetwork[] = []

  private trackedNetworks: EVMNetwork[]

  assetData: AssetDataHelper

  private constructor(
    private db: ChainDatabase,
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

    this.trackedNetworks = []
    this.subscribedAccounts = []
    this.subscribedNetworks = []
    this.transactionsToRetrieve = []

    this.assetData = new AssetDataHelper(this)
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()

    await this.db.initialize()
    await this.initializeNetworks()
    const accounts = await this.getAccountsToTrack()
    const trackedNetworks = await this.getTrackedNetworks()

    const transactions = await this.db.getAllTransactions()

    this.emitter.emit("initializeActivities", { transactions, accounts })

    // get the latest blocks and subscribe for all active networks

    Promise.allSettled(
      accounts
        .flatMap((an) => [
          // subscribe to all account transactions
          this.subscribeToAccountTransactions(an).catch((e) => {
            logger.error(e)
          }),
          // do a base-asset balance check for every account
          this.getLatestBaseAccountBalance(an).catch((e) => {
            logger.error(e)
          }),
        ])
        .concat(
          // Schedule any stored unconfirmed transactions for
          // retrieval---either to confirm they no longer exist, or to
          // read/monitor their status.
          trackedNetworks.map((network) =>
            this.db
              .getNetworkPendingTransactions(network)
              .then((pendingTransactions) => {
                pendingTransactions.forEach(({ hash, firstSeen }) => {
                  logger.debug(
                    `Queuing pending transaction ${hash} for status lookup.`
                  )
                  this.queueTransactionHashToRetrieve(network, hash, firstSeen)
                })
              })
              .catch((e) => {
                logger.error(e)
              })
          )
        )
    )
  }

  async initializeNetworks(): Promise<void> {
    const rpcUrls = await this.db.getAllRpcUrls()

    await this.updateSupportedNetworks()

    this.lastUserActivityOnNetwork =
      Object.fromEntries(
        this.supportedNetworks.map((network) => [network.chainID, 0])
      ) || {}

    this.providers = {
      evm: Object.fromEntries(
        this.supportedNetworks.map((network) => [
          network.chainID,
          makeSerialFallbackProvider(
            network.chainID,
            rpcUrls.find((v) => v.chainID === network.chainID)?.rpcUrls || []
          ),
        ])
      ),
    }
  }

  /**
   * Finds a provider for the given network, or returns undefined if no such
   * provider exists.
   */
  providerForNetwork(network: EVMNetwork): SerialFallbackProvider | undefined {
    if (this.providers.evm[network.chainID] === undefined) {
      this.initializeNetworks().then(() => {
        if (this.providers.evm[network.chainID] === undefined) {
          console.error(`Provider is undefined for network ${network.name}`)
        }
        setProviderForShard(this.providers.evm[network.chainID])
      })
    } else {
      setProviderForShard(this.providers.evm[network.chainID])
    }
    return this.providers.evm[network.chainID]
  }

  /**
   * Pulls the list of tracked networks from memory or indexedDB.
   * Defaults to ethereum in the case that neither exist.
   */
  async getTrackedNetworks(): Promise<EVMNetwork[]> {
    if (this.trackedNetworks.length > 0) {
      return this.trackedNetworks
    }

    // Since trackedNetworks will be an empty array at extension load (or reload time)
    // we need a durable way to track which networks an extension is tracking.
    // The below code should only be called once per extension reload for extensions
    // with active accounts
    const networksToTrack = await this.getNetworksToTrack()

    await Promise.allSettled(
      networksToTrack.map(async (network) =>
        this.startTrackingNetworkOrThrow(network.chainID)
      )
    )

    return this.trackedNetworks
  }

  private async subscribeToNetworkEvents(network: EVMNetwork): Promise<void> {
    const provider = this.providerForNetwork(network)
    if (provider) {
      await Promise.allSettled([
        this.fetchLatestBlockForNetwork(network),
        this.subscribeToNewHeads(network),
      ])
    } else {
      logger.error(`Couldn't find provider for network ${network.name}`)
    }

    this.emitter.emit("networkSubscribed", network)
  }

  /**
   * Adds a supported network to list of active networks.
   */
  async startTrackingNetworkOrThrow(chainID: string): Promise<EVMNetwork> {
    const trackedNetwork = this.trackedNetworks.find((network) =>
      sameChainID(network.chainID, chainID)
    )

    if (trackedNetwork) {
      logger.warn(
        `${trackedNetwork.name} already being tracked - no need to activate it`
      )
      return trackedNetwork
    }

    const networkToTrack = this.supportedNetworks.find((ntwrk) =>
      sameChainID(ntwrk.chainID, chainID)
    )

    if (!networkToTrack) {
      throw new Error(`Network with chainID ${chainID} is not supported`)
    }

    this.trackedNetworks.push(networkToTrack)

    const existingSubscription = this.subscribedNetworks.find(
      (networkSubscription) =>
        networkSubscription.network.chainID === networkToTrack.chainID
    )

    if (!existingSubscription) {
      this.subscribeToNetworkEvents(networkToTrack)
      const addressesToTrack = new Set(
        (await this.getAccountsToTrack()).map((account) => account.address)
      )
      addressesToTrack.forEach((address) => {
        this.addAccountToTrack({
          address,
          network: networkToTrack,
        })
      })
    }

    return networkToTrack
  }

  /**
   * Finds a provider for the given network, or returns undefined if no such
   * provider exists.
   */
  providerForNetworkOrThrow(network: EVMNetwork): SerialFallbackProvider {
    const provider = this.providerForNetwork(network)

    if (!provider) {
      logger.error(
        "Request received for operation on an inactive network",
        network,
        "expected",
        this.trackedNetworks
      )
      throw new Error(
        `Unexpected network ${network.name}, id: ${network.chainID}`
      )
    }
    return provider
  }

  /**
   * Populates the provided partial legacy transaction request with all fields
   * except the nonce. This leaves the transaction ready for user review, and
   * the nonce ready to be filled in immediately prior to signing to minimize the
   * likelihood for nonce reuse.
   *
   * Note that if the partial request already has a defined nonce, it is not
   * cleared.
   */
  private async populatePartialLegacyEVMTransactionRequest(
    network: EVMNetwork,
    partialRequest: EnrichedLegacyTransactionSignatureRequest
  ): Promise<{
    transactionRequest: EnrichedLegacyTransactionRequest
    gasEstimationError: string | undefined
  }> {
    const { from, to, value, gasLimit, input, gasPrice, nonce, annotation } =
      partialRequest
    // Basic transaction construction based on the provided options, with extra data from the chain service
    const transactionRequest: EnrichedLegacyTransactionRequest = {
      from,
      to,
      value: value ?? 0n,
      gasLimit: gasLimit ?? 0n,
      input: input ?? null,
      // we know that a transactionRequest will fail with gasPrice 0
      // and sometimes 3rd party api's (like 0x) may return transaction requests
      // with gasPrice === 0, so we override the set gasPrice in those cases
      gasPrice: gasPrice || (await this.estimateGasPrice(network)),
      type: 0 as const,
      network,
      chainID: network.chainID,
      nonce,
      annotation,
      estimatedRollupGwei:
        network.chainID === OPTIMISM.chainID
          ? await this.estimateL1RollupGasPrice(network)
          : 0n,
      estimatedRollupFee: 0n,
    }

    if (network.chainID === OPTIMISM.chainID) {
      transactionRequest.estimatedRollupFee =
        await this.estimateL1RollupFeeForOptimism(
          network,
          unsignedTransactionFromEVMTransaction(transactionRequest)
        )
    }

    // Always estimate gas to decide whether the transaction will likely fail.
    let estimatedGasLimit: bigint | undefined
    let gasEstimationError: string | undefined
    try {
      estimatedGasLimit = await this.estimateGasLimit(
        network,
        transactionRequest
      )
    } catch (error) {
      logger.error("Error estimating gas limit: ", error)
      // Try to identify unpredictable gas errors to bubble that information
      // out.
      if (error instanceof Error) {
        // Ethers does some heavily loose typing around errors to carry
        // arbitrary info without subclassing Error, so an any cast is needed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyError: any = error

        if (
          "code" in anyError &&
          anyError.code === Logger.errors.UNPREDICTABLE_GAS_LIMIT
        ) {
          gasEstimationError = anyError.error ?? "Unknown transaction error."
        }
      }
    }

    // We use the estimate as the actual limit only if user did not specify the
    // gas explicitly or if it was set below the minimum network-allowed value.
    if (
      typeof estimatedGasLimit !== "undefined" &&
      (typeof gasLimit === "undefined" || gasLimit < 21000n)
    ) {
      transactionRequest.gasLimit = estimatedGasLimit
    }

    return { transactionRequest, gasEstimationError }
  }

  /**
   * Populates the provided partial EIP1559 transaction request with all fields
   * except the nonce. This leaves the transaction ready for user review, and
   * the nonce ready to be filled in immediately prior to signing to minimize the
   * likelihood for nonce reuse.
   *
   * Note that if the partial request already has a defined nonce, it is not
   * cleared.
   */
  private async populatePartialEIP1559TransactionRequest(
    network: EVMNetwork,
    partialRequest: EnrichedEIP1559TransactionSignatureRequest
  ): Promise<{
    transactionRequest: EnrichedEIP1559TransactionRequest
    gasEstimationError: string | undefined
  }> {
    const {
      from,
      to,
      value,
      gasLimit,
      input,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
      annotation,
    } = partialRequest

    // Basic transaction construction based on the provided options, with extra data from the chain service
    const transactionRequest: EnrichedEIP1559TransactionRequest = {
      from,
      to,
      value: value ?? 0n,
      gasLimit: gasLimit ?? 0n,
      maxFeePerGas: maxFeePerGas ?? 0n,
      maxPriorityFeePerGas: maxPriorityFeePerGas ?? 0n,
      input: input ?? null,
      type: network.isQuai ? (0 as const) : (2 as const),
      network,
      chainID: network.chainID,
      nonce,
      annotation,
    }

    // Always estimate gas to decide whether the transaction will likely fail.
    let estimatedGasLimit: bigint | undefined
    let gasEstimationError: string | undefined
    try {
      estimatedGasLimit = await this.estimateGasLimit(
        network,
        transactionRequest
      )
    } catch (error) {
      // Try to identify unpredictable gas errors to bubble that information
      // out.
      if (error instanceof Error) {
        // Ethers does some heavily loose typing around errors to carry
        // arbitrary info without subclassing Error, so an any cast is needed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyError: any = error

        if (
          "code" in anyError &&
          anyError.code === Logger.errors.UNPREDICTABLE_GAS_LIMIT
        ) {
          gasEstimationError = anyError.error ?? "Unknown transaction error."
        }
      }
    }

    // We use the estimate as the actual limit only if user did not specify the
    // gas explicitly or if it was set below the minimum network-allowed value.
    if (
      typeof estimatedGasLimit !== "undefined" &&
      (typeof partialRequest.gasLimit === "undefined" ||
        partialRequest.gasLimit < 21000n)
    ) {
      transactionRequest.gasLimit = estimatedGasLimit
    }

    return { transactionRequest, gasEstimationError }
  }

  async populatePartialTransactionRequest(
    network: EVMNetwork,
    partialRequest: EnrichedEVMTransactionSignatureRequest,
    defaults: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  ): Promise<{
    transactionRequest: EnrichedEVMTransactionRequest
    gasEstimationError: string | undefined
  }> {
    if (EIP_1559_COMPLIANT_CHAIN_IDS.has(network.chainID)) {
      const {
        maxFeePerGas = defaults.maxFeePerGas,
        maxPriorityFeePerGas = defaults.maxPriorityFeePerGas,
      } = partialRequest as EnrichedEIP1559TransactionSignatureRequest

      const populated = await this.populatePartialEIP1559TransactionRequest(
        network,
        {
          ...(partialRequest as EnrichedEIP1559TransactionSignatureRequest),
          maxFeePerGas,
          maxPriorityFeePerGas,
        }
      )
      return populated
    }
    // Legacy Transaction
    const populated = await this.populatePartialLegacyEVMTransactionRequest(
      network,
      {
        ...(partialRequest as EnrichedLegacyTransactionRequest),
      }
    )
    return populated
  }

  /**
   * Populates the nonce for the passed EIP1559TransactionRequest, provided
   * that it is not yet populated. This process generates a new nonce based on
   * the known on-chain nonce state of the service, attempting to ensure that
   * the nonce will be unique and an increase by 1 over any other confirmed or
   * pending nonces in the mempool.
   *
   * Returns the transaction request with a guaranteed-defined nonce, suitable
   * for signing by a signer.
   */
  async populateEVMTransactionNonce(
    transactionRequest: TransactionRequest
  ): Promise<TransactionRequestWithNonce> {
    if (typeof transactionRequest.nonce !== "undefined") {
      // TS undefined checks don't narrow the containing object's type, so we
      // have to cast `as` here.
      return transactionRequest as EIP1559TransactionRequest & { nonce: number }
    }

    const { network, chainID } = transactionRequest
    const normalizedAddress = normalizeEVMAddress(transactionRequest.from)
    const provider = this.providerForNetworkOrThrow(network)

    // https://docs.ethers.io/v5/single-page/#/v5/api/providers/provider/-%23-Provider-getTransactionCount
    const chainTransactionCount = await provider.getTransactionCount(
      transactionRequest.from,
      "latest"
    )
    let knownNextNonce

    // existingNonce handling only needed when there is a chance for it to
    // be different from the onchain nonce. This can happen when a chain has
    // mempool. Note: This does not necessarily mean that the chain is EIP-1559
    // compliant.
    if (CHAINS_WITH_MEMPOOL.has(chainID)) {
      // @TODO: Update this implementation to handle pending txs and also be more
      //        resilient against missing nonce in the mempool.
      const chainNonce = chainTransactionCount - 1

      const existingNonce =
        this.evmChainLastSeenNoncesByNormalizedAddress[chainID]?.[
          normalizedAddress
        ] ?? chainNonce

      this.evmChainLastSeenNoncesByNormalizedAddress[chainID] ??= {}
      // Use the network count, if needed. Note that the assumption here is that
      // all nonces for this address are increasing linearly and continuously; if
      // the address has a pending transaction floating around with a nonce that
      // is not an increase by one over previous transactions, this approach will
      // allocate more nonces that won't mine.
      this.evmChainLastSeenNoncesByNormalizedAddress[chainID][
        normalizedAddress
      ] = Math.max(existingNonce, chainNonce)

      // Allocate a new nonce by incrementing the last seen one.
      this.evmChainLastSeenNoncesByNormalizedAddress[chainID][
        normalizedAddress
      ] += 1
      knownNextNonce =
        this.evmChainLastSeenNoncesByNormalizedAddress[chainID][
          normalizedAddress
        ]

      logger.debug(
        "Got chain nonce",
        chainNonce,
        "existing nonce",
        existingNonce,
        "using",
        knownNextNonce
      )
    }

    return {
      ...transactionRequest,
      nonce: knownNextNonce ?? chainTransactionCount,
    }
  }

  /**
   * Releases the specified nonce for the given network and address. This
   * updates internal service state to allow that nonce to be reused. In cases
   * where multiple nonces were seen in a row, this will make internally
   * available for reuse all intervening nonces.
   */
  releaseEVMTransactionNonce(
    transactionRequest:
      | TransactionRequestWithNonce
      | SignedTransaction
      | AnyEVMTransaction
  ): void {
    const chainID =
      "chainID" in transactionRequest
        ? transactionRequest.chainID
        : transactionRequest.network.chainID
    if (CHAINS_WITH_MEMPOOL.has(chainID)) {
      const { nonce } = transactionRequest
      const normalizedAddress = normalizeEVMAddress(transactionRequest.from)

      if (
        !this.evmChainLastSeenNoncesByNormalizedAddress[chainID]?.[
          normalizedAddress
        ]
      ) {
        return
      }

      const lastSeenNonce =
        this.evmChainLastSeenNoncesByNormalizedAddress[chainID][
          normalizedAddress
        ]

      // TODO Currently this assumes that the only place this nonce could have
      // TODO been used is this service; however, another wallet or service
      // TODO could have broadcast a transaction with this same nonce, in which
      // TODO case the nonce release shouldn't take effect! This should be a
      // TODO relatively rare edge case, but we should handle it at some point.
      if (nonce === lastSeenNonce) {
        this.evmChainLastSeenNoncesByNormalizedAddress[chainID][
          normalizedAddress
        ] -= 1
      } else if (nonce < lastSeenNonce) {
        // If the nonce we're releasing is below the latest allocated nonce,
        // release all intervening nonces. This risks transaction replacement
        // issues, but ensures that we don't start allocating nonces that will
        // never mine (because they will all be higher than the
        // now-released-and-therefore-never-broadcast nonce).
        this.evmChainLastSeenNoncesByNormalizedAddress[chainID][
          normalizedAddress
        ] = nonce - 1
      }
    }
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
    network: EVMNetwork
  ): Promise<AddressOnNetwork[]> {
    return this.db.getTrackedAddressesOnNetwork(network)
  }

  async getNetworksToTrack(): Promise<EVMNetwork[]> {
    const chainIDs = await this.db.getChainIDsToTrack()
    if (chainIDs.size === 0) {
      // Default to tracking Ethereum so ENS resolution works during onboarding
      return [QUAI_NETWORK]
    }

    const networks = await Promise.all(
      [...chainIDs].map(async (chainID) => {
        const network = NETWORK_BY_CHAIN_ID[chainID]
        if (!network) {
          return this.db.getEVMNetworkByChainID(chainID)
        }
        return network
      })
    )
    return networks.filter((network): network is EVMNetwork => !!network)
  }

  async removeAccountToTrack(address: string): Promise<void> {
    await this.db.removeAccountToTrack(address)
  }

  async removeActivities(address: string): Promise<void> {
    await this.db.removeActivities(address)
  }

  async getLatestBaseAccountBalance({
    address,
    network,
  }: AddressOnNetwork): Promise<AccountBalance> {
    const normalizedAddress = normalizeEVMAddress(address)
    const prevShard = globalThis.main.SelectedShard
    const addrShard = getShardFromAddress(address)
    if (globalThis.main.SelectedShard !== addrShard) {
      // Ideally this never happens, but it might
      globalThis.main.SetShard(addrShard)
    }
    let err = false
    let balance = BigNumber.from(0)
    const provider = getProviderForGivenShard(
      this.providers.evm[network.chainID],
      addrShard
    )
    try {
      balance = await provider.getBalance(normalizedAddress)
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
          `Global shard: ${globalThis.main.SelectedShard} Address shard: ${addrShard} Provider: ${provider.connection.url}`
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

    const accountBalance: AccountBalance = {
      address: normalizedAddress,
      network,
      assetAmount: {
        // Data stored in chain db for network base asset might be stale
        asset: await this.db.getBaseAssetForNetwork(network.chainID),
        amount: balance.toBigInt(),
      },
      dataSource: "local", // TODO do this properly (eg provider isn't Alchemy)
      retrievedAt: Date.now(),
    }

    // Don't emit or save if the account isn't tracked
    if (allTrackedAddresses.has(normalizedAddress)) {
      this.emitter.emit("accountsWithBalances", {
        balances: [accountBalance],
        addressOnNetwork: {
          address: normalizedAddress,
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

  async getBlockHeight(network: EVMNetwork): Promise<number> {
    const cachedBlock = await this.db.getLatestBlock(network)
    if (cachedBlock) {
      return cachedBlock.blockHeight
    }
    return this.providerForNetworkOrThrow(network).getBlockNumber()
  }

  /**
   * Return cached information on a block if it's in the local DB.
   *
   * Otherwise, retrieve the block from the specified network, caching and
   * returning the object.
   *
   * @param network the EVM network we're interested in
   * @param blockHash the hash of the block we're interested in
   */
  async getBlockData(
    network: EVMNetwork,
    blockHash: string
  ): Promise<AnyEVMBlock> {
    const cachedBlock = await this.db.getBlock(network, blockHash)
    if (cachedBlock) {
      return cachedBlock
    }

    // Looking for new block
    const resultBlock = await this.providerForNetworkOrThrow(network).getBlock(
      blockHash
    )

    const block = blockFromEthersBlock(network, resultBlock)

    await this.db.addBlock(block)
    this.emitter.emit("block", block)
    return block
  }

  /**
   * Return cached information on a block if it's in the local DB.
   *
   * Otherwise, retrieve the block from the specified *shard*, caching and
   * returning the object.
   *
   * @param network the EVM network we're interested in
   * @param blockHash the hash of the block we're interested in
   */
  async getBlockDataExternal(
    network: EVMNetwork,
    shard: string,
    blockHash: string
  ): Promise<AnyEVMBlock> {
    const cachedBlock = await this.db.getBlock(network, blockHash)
    if (cachedBlock) {
      return cachedBlock
    }

    // Convert shard string. Map 0 to cyprus, 1 to paxos, 2 to hydra
    // zone-0-0 should become cyprus-1
    // zone-1-2 shoule become paxos-3
    // zone-2-1 should become hydra-2
    const regionNames = ["cyprus", "paxos", "hydra"]
    const shardSplit = shard.split("-")
    const shardName = `${regionNames[+shardSplit[1]]}-${(
      +shardSplit[2] + 1
    ).toString()}`

    const provider = getProviderForGivenShard(
      this.providers.evm[network.chainID],
      shardName
    )
    console.log(provider)

    const resultBlock = await provider.getBlock(blockHash)

    console.log(resultBlock)

    const block = blockFromEthersBlock(network, resultBlock)

    await this.db.addBlock(block)
    this.emitter.emit("block", block)
    return block
  }

  /**
   * Return cached information on a transaction, if it's both confirmed and
   * in the local DB.
   *
   * Otherwise, retrieve the transaction from the specified network, caching and
   * returning the object.
   *
   * @param network the EVM network we're interested in
   * @param txHash the hash of the unconfirmed transaction we're interested in
   */
  async getTransaction(
    network: EVMNetwork,
    txHash: HexString
  ): Promise<AnyEVMTransaction> {
    const cachedTx = await this.db.getTransaction(network, txHash)
    // If tx is cached and already included in a block, don't need to query provider
    if (cachedTx && cachedTx.blockHash != undefined) {
      return cachedTx
    }
    const gethResult = await this.providerForNetworkOrThrow(
      network
    ).getTransaction(txHash)
    const newTransaction = transactionFromEthersTransaction(gethResult, network)

    if (!newTransaction.blockHash && !newTransaction.blockHeight) {
      this.subscribeToTransactionConfirmation(network, newTransaction)
    }

    // TODO proper provider string
    this.saveTransaction(newTransaction, "local")
    return newTransaction
  }

  /**
   * Should check the status of emitted ETX and update the status of the ITX
   *
   * @param network the EVM network we're interested in
   * @param txHash the hash of the ITX (that emits 1 ETX) transaction we're interested in
   */
  async getETX(
    network: EVMNetwork,
    txHash: HexString,
    destinationShard: string
  ): Promise<AnyEVMTransaction> {
    const cachedTx = await this.db.getTransaction(network, txHash)

    // Transaction is already included in origin chain block, and etx is settled in destination
    if (
      cachedTx &&
      cachedTx.blockHash != undefined &&
      "status" in cachedTx &&
      cachedTx.status == 2
    ) {
      return cachedTx
    }

    // Provider for destination shard
    const destinationProvider = getProviderForGivenShard(
      this.providers.evm[network.chainID],
      destinationShard
    )
    const originProvider = this.providerForNetworkOrThrow(network)

    // Transaction hasn't confirmed in origin chain yet
    if (!cachedTx || cachedTx.blockHash == undefined) {
      console.log("Transaction hasn't confirmed in origin chain yet")
      const gethResult = await originProvider.getTransaction(txHash)

      const newTransaction = transactionFromEthersTransaction(
        gethResult,
        network
      )

      if (!newTransaction.blockHash && !newTransaction.blockHeight) {
        this.subscribeToTransactionConfirmation(network, newTransaction)
      }

      // Retrieve Transaction Receipt which should save it
      this.retrieveTransactionReceipt(network, newTransaction)

      // If transaction hadn't been cached yet, its ETX definetly hasn't been confirmed yet, so we can return
      return newTransaction
    }

    // If tx is cached and already included in a block, its ETX is possibly confirmed
    if (cachedTx) {
      if (cachedTx.to == undefined) {
        return cachedTx
      }

      const etxHash = "etxs" in cachedTx ? cachedTx.etxs[0].hash : undefined
      if (!etxHash) {
        return cachedTx
      }

      const gethResult = await destinationProvider.getTransaction(etxHash)
      let newTransaction
      if (gethResult) {
        newTransaction = transactionFromEthersTransaction(gethResult, network)
      }

      if (!newTransaction) {
        return cachedTx
      }

      if (!newTransaction.blockHash && !newTransaction.blockHeight) {
        this.subscribeToETXConfirmation(network, cachedTx, newTransaction)
      }

      // ETX has been settled in destination chain
      // Overwrite the cachedTx to have status = 2
      "status" in cachedTx ? (cachedTx.status = 2) : undefined
      this.saveTransaction(cachedTx, "local")

      // Also save the emitted ETX
      this.saveTransaction(newTransaction, "local")
      return newTransaction
    }

    // Transaction is not cached
    const gethResult = await this.providerForNetworkOrThrow(
      network
    ).getTransaction(txHash)
    const newTransaction = transactionFromEthersTransaction(gethResult, network)

    if (!newTransaction.blockHash && !newTransaction.blockHeight) {
      this.subscribeToTransactionConfirmation(network, newTransaction)
    }

    // TODO proper provider string
    this.saveTransaction(newTransaction, "local")
    return newTransaction
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
    network: EVMNetwork,
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
   * @param txHash The hash of a tx to check.
   * @returns true if the tx hash is in the queue, false otherwise.
   */
  isTransactionHashQueued(txNetwork: EVMNetwork, txHash: HexString): boolean {
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
  removeTransactionHashFromQueue(network: EVMNetwork, txHash: HexString): void {
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
  async estimateGasLimit(
    network: EVMNetwork,
    transactionRequest: TransactionRequest
  ): Promise<bigint> {
    if (isEnabled(FeatureFlags.USE_MAINNET_FORK)) {
      return 350000n
    }
    const estimate = await this.providerForNetworkOrThrow(network).estimateGas(
      ethersTransactionFromTransactionRequest(transactionRequest)
    )

    // Add 10% more gas as a safety net
    const uppedEstimate = estimate.add(estimate.div(10))
    return BigInt(uppedEstimate.toString())
  }

  async estimateL1RollupGasPrice(network: EVMNetwork): Promise<bigint> {
    if (network.chainID === OPTIMISM.chainID) {
      // Using the L1 gas cost is not a completely accurate representation of
      // what the rollup fee will be - but is close enough outside of periods of extreme
      // volatility.  More reading here:
      // https://help.optimism.io/hc/en-us/articles/4416677738907-What-happens-if-the-L1-gas-price-spikes-while-a-transaction-is-in-process
      return this.estimateGasPrice(ETHEREUM)
    }
    throw new Error(`Cannot estimate rollup gas for ${network.name}`)
  }

  async estimateL1RollupFeeForOptimism(
    network: EVMNetwork,
    transaction: UnsignedTransaction | EnrichedEVMTransactionRequest
  ): Promise<bigint> {
    // Optimism-specific implementation
    // https://community.optimism.io/docs/developers/build/transaction-fees/#displaying-fees-to-users
    const unsignedRLPEncodedTransaction = utils.serializeTransaction({
      to: transaction.to,
      nonce: transaction.nonce,
      gasLimit: transaction.gasLimit,
      gasPrice: "gasPrice" in transaction ? transaction.gasPrice : undefined,
      data: "data" in transaction ? transaction.data : undefined,
      value: "value" in transaction ? transaction.value : undefined,
    })

    const provider = await this.providerForNetworkOrThrow(network)

    const GasOracle = new quais.Contract(
      OPTIMISM_GAS_ORACLE_ADDRESS,
      OPTIMISM_GAS_ORACLE_ABI,
      provider
    )

    const l1Fee = await GasOracle.getL1Fee(unsignedRLPEncodedTransaction)

    return BigInt(l1Fee.toString())
  }

  /**
   * Estimate the gas needed to make a transaction. Adds 10% as a safety net to
   * the base estimate returned by the provider.
   */
  private async estimateGasPrice(network: EVMNetwork): Promise<bigint> {
    const estimate = await this.providerForNetworkOrThrow(network).getGasPrice()

    // Add 10% more gas as a safety net
    return (estimate.toBigInt() * 11n) / 10n
  }

  /**
   * Broadcast a signed EVM transaction.
   *
   * @param transaction A signed EVM transaction to broadcast. Since the tx is signed,
   *        it needs to include all gas limit and price params.
   */
  async broadcastSignedTransaction(
    transaction: SignedTransaction
  ): Promise<void> {
    try {
      const serialized = utils.serializeTransaction(
        ethersTransactionFromSignedTransaction(transaction),
        { r: transaction.r, s: transaction.s, v: transaction.v }
      )

      await Promise.all([
        this.providerForNetworkOrThrow(transaction.network)
          .sendTransaction(serialized)
          .then((transactionResponse) => {
            this.emitter.emit("transactionSend", transactionResponse.hash)
          })
          .catch((error) => {
            logger.debug(
              "Broadcast error caught, saving failed status and releasing nonce...",
              transaction,
              error
            )
            // Failure to broadcast needs to be registered.
            this.saveTransaction(
              { ...transaction, status: 0, error: error.toString() },
              "local"
            )
            // the reject here will release the nonce in the following catch
            return Promise.reject(error)
          }),
        this.subscribeToTransactionConfirmation(
          transaction.network,
          transaction
        ),
        this.saveTransaction(transaction, "local"),
      ])
    } catch (error) {
      this.releaseEVMTransactionNonce(transaction)
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
      // Reactivating a potentially deactivated network
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
   * Write block prices to IndexedDB so we have them for later
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
    if (!this.isCurrentlyActiveChainID(chainID)) {
      return
    }

    const subscription = this.subscribedNetworks.find(
      ({ network }) => toHexChainID(network.chainID) === toHexChainID(chainID)
    )

    if (!subscription) {
      logger.warn(
        `Can't fetch block prices for unsubscribed chainID ${chainID}`
      )
      return
    }

    const blockPrices = await getBlockPrices(
      subscription.network,
      subscription.provider
    )
    this.emitter.emit("blockPrices", {
      blockPrices,
      network: subscription.network,
    })
  }

  /*
   * Fetch, persist, and emit the latest block on a given network.
   */
  private async pollLatestBlock(
    network: EVMNetwork,
    provider: SerialFallbackProvider
  ): Promise<void> {
    const ethersBlock = await provider.getBlock("latest")
    // add new head to database
    const block = blockFromProviderBlock(network, ethersBlock)
    await this.db.addBlock(block)
    // emit the new block, don't wait to settle
    this.emitter.emit("block", block)
    // TODO if it matches a known blockheight and the difficulty is higher,
    // emit a reorg event
  }

  async send(
    method: string,
    params: unknown[],
    network: EVMNetwork
  ): Promise<unknown> {
    return this.providerForNetworkOrThrow(network).send(method, params)
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
    network: EVMNetwork,
    hash: string
  ): Promise<TransactionResponse | null | undefined> {
    const provider = this.providerForNetworkOrThrow(network)
    const result = await provider.getTransaction(hash)

    if (!result) {
      logger.warn(
        `Tx hash ${hash} is found in our local registry but not on chain.`
      )

      this.removeTransactionHashFromQueue(network, hash)
      // Let's clean up the subscriptions
      this.providerForNetwork(network)?.off(hash)

      const savedTx = await this.db.getTransaction(network, hash)
      if (savedTx && !("status" in savedTx)) {
        // Let's see if we have the tx in the db, and if yes let's mark it as dropped.
        this.saveTransaction(
          {
            ...savedTx,
            status: 0, // dropped status
            error:
              "Transaction was in our local db but was not found on chain.",
            blockHash: null,
            blockHeight: null,
          },
          "local"
        )

        // Let's also release the nonce from our bookkeeping.
        await this.releaseEVMTransactionNonce(savedTx)
      }
    }

    return result
  }

  /* *****************
   * PRIVATE METHODS *
   * **************** */

  /**
   * Load recent asset transfers from an account on a particular network.
   *
   * @param addressNetwork the address and network whose asset transfers we need
   * @param incomingOnly if true, only fetch asset transfers received by this
   *        address
   */
  private async loadRecentAssetTransfers(
    addressNetwork: AddressOnNetwork,
    incomingOnly = false
  ): Promise<void> {
    const blockHeight =
      (await this.getBlockHeight(addressNetwork.network)) -
      BLOCKS_TO_SKIP_FOR_TRANSACTION_HISTORY
    const fromBlock = blockHeight - BLOCKS_FOR_TRANSACTION_HISTORY

    try {
      return await this.loadAssetTransfers(
        addressNetwork,
        BigInt(fromBlock),
        BigInt(blockHeight),
        incomingOnly
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
   */
  private async loadAssetTransfers(
    addressOnNetwork: AddressOnNetwork,
    startBlock: bigint,
    endBlock: bigint,
    incomingOnly = false
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

    const assetTransfers = await this.assetData.getAssetTransfers(
      addressOnNetwork,
      Number(startBlock),
      Number(endBlock),
      incomingOnly
    )

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
      await this.db.getAllSavedTransactionHashes()
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
        return this.loadRecentAssetTransfers(addressNetwork, true)
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
      const result = await this.getOrCancelTransaction(network, hash)

      if (!result) {
        return
      }

      const transaction = transactionFromEthersTransaction(result, network)

      // TODO make this provider type specific
      await this.saveTransaction(transaction, "local")

      if (
        !("status" in transaction) && // if status field is present then it's not a pending tx anymore.
        !transaction.blockHash &&
        !transaction.blockHeight
      ) {
        // It's a pending tx, let's subscribe to events.
        this.subscribeToTransactionConfirmation(
          transaction.network,
          transaction
        )
      } else if (transaction.blockHash) {
        // Get relevant block data.
        await this.getBlockData(transaction.network, transaction.blockHash)
        // Retrieve gas used, status, etc
        this.retrieveTransactionReceipt(transaction.network, transaction)
      }
    } catch (error) {
      logger.error(`Error retrieving transaction ${hash}`, error)
      if (Date.now() <= firstSeen + TRANSACTION_CHECK_LIFETIME_MS) {
        this.queueTransactionHashToRetrieve(network, hash, firstSeen)
      } else {
        logger.warn(
          `Transaction ${hash} is too old to keep looking for it; treating ` +
            "it as expired."
        )

        this.db.getTransaction(network, hash).then((existingTransaction) => {
          if (existingTransaction !== null) {
            logger.debug(
              "Found existing transaction for expired lookup; marking as " +
                "failed if no other status exists."
            )
            this.saveTransaction(
              // Don't override an already-persisted successful status with
              // an expiration-based failed status, but do set status to
              // failure if no transaction was seen.
              { status: 0, ...existingTransaction },
              "local"
            )
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
    transaction: AnyEVMTransaction,
    dataSource: "local" | "alchemy"
  ): Promise<void> {
    // Merge existing data into the updated transaction data. This handles
    // cases where an existing transaction has been enriched by e.g. a receipt,
    // and new data comes in.
    const existing = await this.db.getTransaction(
      transaction.network,
      transaction.hash
    )
    const finalTransaction = {
      ...existing,
      ...transaction,
    }

    let error: unknown = null
    try {
      await this.db.addOrUpdateTransaction(
        {
          // Don't lose fields the existing transaction has pulled, e.g. from a
          // transaction receipt.
          ...existing,
          ...finalTransaction,
        },
        dataSource
      )
    } catch (err) {
      error = err
      logger.error(`Error saving tx ${finalTransaction}`, error)
    }
    try {
      let accounts = await this.getAccountsToTrack()
      if (accounts.length === 0) {
        this.db.addAccountToTrack({
          address: finalTransaction.from,
          network: finalTransaction.network,
        })
        accounts = await this.getAccountsToTrack()
      }
      const forAccounts = getRelevantTransactionAddresses(
        finalTransaction,
        accounts
      )

      // emit in a separate try so outside services still get the tx
      this.emitter.emit("transaction", {
        transaction: finalTransaction,
        forAccounts,
      })
    } catch (err) {
      error = err
      logger.error(`Error emitting tx ${finalTransaction}`, error)
    }
    if (error) {
      throw error
    }
  }

  async emitSavedTransactions(account: AddressOnNetwork): Promise<void> {
    const { address, network } = account
    const transactionsForNetwork = await this.db.getTransactionsForNetwork(
      network
    )

    const transactions = transactionsForNetwork.filter(
      (transaction) =>
        sameEVMAddress(transaction.from, address) ||
        sameEVMAddress(transaction.to, address)
    )

    this.emitter.emit("initializeActivitiesForAccount", {
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
          sameEVMAddress(trackedAddress, address) &&
          network.name === trackedNetwork.name
      )
    )
  }

  /**
   * Get the latest block for a network and save it to the db.
   *
   * @param network The EVM network to watch.
   */
  private async fetchLatestBlockForNetwork(network: EVMNetwork): Promise<void> {
    const provider = this.providerForNetwork(network)
    if (provider) {
      try {
        const blockNumber = provider.getBlockNumber()
        const result = await provider.getBlock(blockNumber)
        const block = blockFromEthersBlock(network, result)
        await this.db.addBlock(block)
      } catch (e) {
        logger.error("Error getting block number", e)
      }
    }
  }

  public ProviderForNetwork(network: EVMNetwork): SerialFallbackProvider {
    return this.providerForNetworkOrThrow(network)
  }

  /**
   * Watch a network for new blocks, saving each to the database and emitting an
   * event. Re-orgs are currently ignored.
   *
   * @param network The EVM network to watch.
   */
  private async subscribeToNewHeads(network: EVMNetwork): Promise<void> {
    const provider = this.providerForNetworkOrThrow(network)
    // eslint-disable-next-line no-underscore-dangle
    this.subscribedNetworks.push({
      network,
      provider,
    })

    this.pollLatestBlock(network, provider)
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
    const provider = this.providerForNetworkOrThrow(network)
    await provider.subscribeFullPendingTransactions(
      { address, network },
      this.handlePendingTransaction.bind(this)
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
   */
  private async handlePendingTransaction(
    transaction: AnyEVMTransaction
  ): Promise<void> {
    try {
      const { network } = transaction
      const normalizedFromAddress = normalizeEVMAddress(transaction.from)

      // If this is an EVM chain, we're tracking the from address's
      // nonce, and the pending transaction has a higher nonce, update our
      // view of it. This helps reduce the number of times when a
      // transaction submitted outside of this wallet causes this wallet to
      // produce bad transactions with reused nonces.
      if (
        typeof network.chainID !== "undefined" &&
        typeof this.evmChainLastSeenNoncesByNormalizedAddress[
          network.chainID
        ]?.[normalizedFromAddress] !== "undefined" &&
        this.evmChainLastSeenNoncesByNormalizedAddress[network.chainID]?.[
          normalizedFromAddress
        ] <= transaction.nonce
      ) {
        this.evmChainLastSeenNoncesByNormalizedAddress[network.chainID][
          normalizedFromAddress
        ] = transaction.nonce
      }
      await this.saveTransaction(transaction, "local")

      // Wait for confirmation/receipt information.
      this.subscribeToTransactionConfirmation(network, transaction)
    } catch (error) {
      logger.error(`Error saving tx: ${transaction}`, error)
    }
  }

  /**
   * Track an pending transaction's confirmation status, saving any updates to
   * the database and informing subscribers via the emitter.
   *
   * @param network the EVM network we're interested in
   * @param transaction the unconfirmed transaction we're interested in
   */
  private async subscribeToTransactionConfirmation(
    network: EVMNetwork,
    transaction: AnyEVMTransaction
  ): Promise<void> {
    const provider = this.providerForNetworkOrThrow(network)
    provider.once(transaction.hash, (confirmedReceipt: TransactionReceipt) => {
      this.saveTransaction(
        enrichTransactionWithReceipt(transaction, confirmedReceipt),
        "local"
      )

      this.removeTransactionHashFromQueue(network, transaction.hash)
    })

    // Let's add the transaction to the queued lookup. If the transaction is dropped
    // because of wrong nonce on chain the event will never arrive.
    this.queueTransactionHashToRetrieve(network, transaction.hash, Date.now())
  }

  private async subscribeToETXConfirmation(
    network: EVMNetwork,
    itx: AnyEVMTransaction,
    etx: AnyEVMTransaction
  ): Promise<void> {
    const provider = this.providerForNetworkOrThrow(network)
    provider.once(etx.hash, (confirmedReceipt: TransactionReceipt) => {
      this.saveTransaction(
        enrichTransactionWithReceipt(etx, confirmedReceipt),
        "local"
      )

      this.saveTransaction(
        {
          ...itx,
          status: 2,
        },
        "local"
      )

      this.removeTransactionHashFromQueue(network, etx.hash)
    })
  }

  /**
   * Retrieve a confirmed transaction's transaction receipt, saving the results.
   *
   * @param network the EVM network we're interested in
   * @param transaction the confirmed transaction we're interested in
   */
  private async retrieveTransactionReceipt(
    network: EVMNetwork,
    transaction: AnyEVMTransaction
  ): Promise<void> {
    const provider = this.providerForNetworkOrThrow(network)
    const receipt = await provider.getTransactionReceipt(transaction.hash)
    if (receipt) {
      await this.saveTransaction(
        enrichTransactionWithReceipt(transaction, receipt),
        "local"
      )
    }
  }

  async getNetworkBaseAssets(): Promise<NetworkBaseAsset[]> {
    return this.db.getAllBaseAssets()
  }

  // Used to add non-default chains via wallet_addEthereumChain
  async addCustomChain(
    chainInfo: ValidatedAddEthereumChainParameter
  ): Promise<EVMNetwork> {
    const network = await this.db.addEVMNetwork({
      chainName: chainInfo.chainName,
      chainID: chainInfo.chainId,
      decimals: chainInfo.nativeCurrency.decimals,
      symbol: chainInfo.nativeCurrency.symbol,
      assetName: chainInfo.nativeCurrency.name,
      rpcUrls: chainInfo.rpcUrls,
      blockExplorerURL: chainInfo.blockExplorerUrl,
    })
    await this.updateSupportedNetworks()

    this.providers.evm[chainInfo.chainId] = makeSerialFallbackProvider(
      chainInfo.chainId,
      chainInfo.rpcUrls
    )

    await this.startTrackingNetworkOrThrow(chainInfo.chainId)

    this.emitter.emit("customChainAdded", chainInfo)
    return network
  }

  async removeCustomChain(chainID: string): Promise<void> {
    this.trackedNetworks = this.trackedNetworks.filter(
      (network) => network.chainID !== chainID
    )

    await this.db.removeEVMNetwork(chainID)
    await this.updateSupportedNetworks()
  }

  async updateSupportedNetworks(): Promise<void> {
    const supportedNetworks = await this.db.getAllEVMNetworks()

    this.supportedNetworks = supportedNetworks
    this.emitter.emit("supportedNetworks", supportedNetworks)
  }

  async queryAccountTokenDetails(
    contractAddress: NormalizedEVMAddress,
    addressOnNetwork: AddressOnNetwork,
    existingAsset?: SmartContractFungibleAsset
  ): Promise<AnyAssetAmount<SmartContractFungibleAsset>> {
    const { network } = addressOnNetwork

    const balance = await this.assetData.getTokenBalance(
      addressOnNetwork,
      contractAddress
    )

    if (existingAsset) {
      return {
        asset: existingAsset,
        amount: balance.amount,
      }
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
