import browser, { runtime } from "webextension-polyfill"
import { alias, wrapStore } from "webext-redux"
import deepDiff from "webext-redux/lib/strategies/deepDiff/diff"
import { configureStore, isPlain, Middleware } from "@reduxjs/toolkit"
import { devToolsEnhancer } from "@redux-devtools/remote"
import { PermissionRequest } from "@pelagus-provider/provider-bridge-shared"
import { debounce } from "lodash"
import { utils } from "ethers"
import { JsonRpcProvider, WebSocketProvider } from "@ethersproject/providers"
import {
  JsonRpcProvider as QuaisJsonRpcProvider,
  WebSocketProvider as QuaisWebSocketProvider,
} from "@quais/providers"
import {
  decodeJSON,
  encodeJSON,
  normalizeEVMAddress,
  sameEVMAddress,
  wait,
} from "./lib/utils"
import {
  BaseService,
  ChainService,
  EnrichmentService,
  IndexingService,
  InternalEthereumProviderService,
  KeyringService,
  NameService,
  PreferenceService,
  ProviderBridgeService,
  TelemetryService,
  ServiceCreatorFunction,
  SigningService,
  AnalyticsService,
} from "./services"
import { HexString, KeyringTypes, NormalizedEVMAddress } from "./types"
import { ChainIdWithError, SignedTransaction } from "./networks"
import { AccountBalance, AddressOnNetwork, NameOnNetwork } from "./accounts"
import rootReducer from "./redux-slices"
import {
  AccountType,
  deleteAccount,
  loadAccount,
  updateAccountBalance,
  updateAccountName,
} from "./redux-slices/accounts"
import {
  assetsLoaded,
  refreshAsset,
  removeAssetData,
} from "./redux-slices/assets"
import {
  emitter as keyringSliceEmitter,
  keyringLocked,
  keyringUnlocked,
  updateKeyrings,
  setKeyringToVerify,
} from "./redux-slices/keyrings"
import { blockSeen, setEVMNetworks } from "./redux-slices/networks"
import {
  initializationLoadingTimeHitLimit,
  emitter as uiSliceEmitter,
  setDefaultWallet,
  setSelectedAccount,
  setSnackbarMessage,
  setAccountsSignerSettings,
  toggleCollectAnalytics,
  setShowAnalyticsNotification,
  setSelectedNetwork,
  setNewNetworkConnectError,
  setShowDefaultWalletBanner,
} from "./redux-slices/ui"
import {
  estimatedFeesPerGas,
  emitter as transactionConstructionSliceEmitter,
  transactionRequest,
  updateTransactionData,
  clearTransactionState,
  TransactionConstructionStatus,
  rejectTransactionSignature,
  transactionSigned,
  clearCustomGas,
} from "./redux-slices/transaction-construction"
import { selectDefaultNetworkFeeSettings } from "./redux-slices/selectors/transactionConstructionSelectors"
import { allAliases } from "./redux-slices/utils"
import {
  requestPermission,
  emitter as providerBridgeSliceEmitter,
  initializePermissions,
  revokePermissionsForAddress,
} from "./redux-slices/dapp"
import logger from "./lib/logger"
import {
  rejectDataSignature,
  clearSigningState,
  signedTypedData,
  signedData as signedDataAction,
  signingSliceEmitter,
  typedDataRequest,
  signDataRequest,
} from "./redux-slices/signing"
import { SignTypedDataRequest, MessageSigningRequest } from "./utils/signing"
import { getShardFromAddress } from "./constants"
import {
  AccountSigner,
  SignatureResponse,
  TXSignatureResponse,
} from "./services/signing"
import {
  migrateReduxState,
  REDUX_STATE_VERSION,
} from "./redux-slices/migrations"
import { PermissionMap } from "./services/provider-bridge/utils"
import { PELAGUS_INTERNAL_ORIGIN } from "./services/internal-ethereum-provider/constants"
import {
  ActivityDetail,
  addActivity,
  initializeActivities,
  initializeActivitiesForAccount,
  removeActivities,
} from "./redux-slices/activities"
import { selectActivitesHashesForEnrichment } from "./redux-slices/selectors"
import { getActivityDetails } from "./redux-slices/utils/activities-utils"
import { getRelevantTransactionAddresses } from "./services/enrichment/utils"
import { AccountSignerWithId } from "./signing"
import { AnalyticsPreferences } from "./services/preferences/types"
import {
  AnyAssetMetadata,
  isSmartContractFungibleAsset,
  SmartContractAsset,
  SmartContractFungibleAsset,
} from "./assets"
import { AddChainRequestData } from "./services/provider-bridge"
import {
  AnalyticsEvent,
  isOneTimeAnalyticsEvent,
  OneTimeAnalyticsEvent,
} from "./lib/posthog"
import { isBuiltInNetworkBaseAsset } from "./redux-slices/utils/asset-utils"
import localStorageShim from "./utils/local-storage-shim"
import { SignerImportMetadata } from "./services/keyring"

// This sanitizer runs on store and action data before serializing for remote
// redux devtools. The goal is to end up with an object that is directly
// JSON-serializable and deserializable; the remote end will display the
// resulting objects without additional processing or decoding logic.
const devToolsSanitizer = (input: unknown) => {
  switch (typeof input) {
    // We can make use of encodeJSON instead of recursively looping through
    // the input
    case "bigint":
    case "object":
      return JSON.parse(encodeJSON(input))
    // We only need to sanitize bigints and objects that may or may not contain
    // them.
    default:
      return input
  }
}

const persistStoreFn = <T>(state: T) => {
  if (process.env.WRITE_REDUX_CACHE === "true") {
    // Browser extension storage supports JSON natively, despite that we have
    // to stringify to preserve BigInts
    browser.storage.local.set({
      state: encodeJSON(state),
      version: REDUX_STATE_VERSION,
    })
  }
}

const persistStoreState = debounce(persistStoreFn, 50, {
  trailing: true,
  maxWait: 50,
})

const reduxCache: Middleware = (store) => (next) => (action) => {
  const result = next(action)
  const state = store.getState()

  persistStoreState(state)
  return result
}

declare global {
  var main: Main
}

// Declared out here so ReduxStoreType can be used in Main.store type
// declaration.
const initializeStore = (preloadedState: object, main: Main) =>
  configureStore({
    preloadedState,
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => {
      const middleware = getDefaultMiddleware({
        serializableCheck: {
          isSerializable: (value: unknown) =>
            isPlain(value) || typeof value === "bigint",
        },
        thunk: { extraArgument: { main } },
      })

      // It might be tempting to use an array with `...` destructuring, but
      // unfortunately this fails to preserve important type information from
      // `getDefaultMiddleware`. `push` and `pull` preserve the type
      // information in `getDefaultMiddleware`, including adjustments to the
      // dispatch function type, but as a tradeoff nothing added this way can
      // further modify the type signature. For now, that's fine, as these
      // middlewares don't change acceptable dispatch types.
      //
      // Process aliases before all other middleware, and cache the redux store
      // after all middleware gets a chance to run.
      middleware.unshift(alias(allAliases))
      middleware.push(reduxCache)

      return middleware
    },
    devTools: false,
    enhancers:
      process.env.NODE_ENV === "development"
        ? [
            devToolsEnhancer({
              hostname: "localhost",
              port: 8000,
              realtime: true,
              actionSanitizer: devToolsSanitizer,
              stateSanitizer: devToolsSanitizer,
            }),
          ]
        : [],
  })

type ReduxStoreType = ReturnType<typeof initializeStore>

export const popupMonitorPortName = "popup-monitor"

let walletOpen = false

// TODO Rename ReduxService or CoordinationService, move to services/, etc.
export default class Main extends BaseService<never> {
  /**
   * The redux store for the wallet core. Note that the redux store is used to
   * render the UI (via webext-redux), but it is _not_ the source of truth.
   * Services interact with the various external and internal components and
   * create persisted state, and the redux store is simply a view onto those
   * pieces of canonical state.
   */
  store: ReduxStoreType

  public SelectedShard: string

  public UrlToProvider: Map<
    string,
    | JsonRpcProvider
    | WebSocketProvider
    | QuaisJsonRpcProvider
    | QuaisWebSocketProvider
  >

  public ready: Promise<boolean>

  balanceChecker: NodeJS.Timer

  static create: ServiceCreatorFunction<never, Main, []> = async () => {
    const preferenceService = PreferenceService.create()
    const keyringService = KeyringService.create()
    const chainService = ChainService.create(preferenceService, keyringService)
    const indexingService = IndexingService.create(
      preferenceService,
      chainService
    )
    const nameService = NameService.create(chainService, preferenceService)
    const enrichmentService = EnrichmentService.create(
      chainService,
      indexingService,
      nameService
    )
    const internalEthereumProviderService =
      InternalEthereumProviderService.create(chainService, preferenceService)
    const providerBridgeService = ProviderBridgeService.create(
      internalEthereumProviderService,
      preferenceService
    )
    const telemetryService = TelemetryService.create()
    const signingService = SigningService.create(keyringService, chainService)
    const analyticsService = AnalyticsService.create(preferenceService)

    let savedReduxState = {}
    // Setting READ_REDUX_CACHE to false will start the extension with an empty
    // initial state, which can be useful for development
    if (process.env.READ_REDUX_CACHE === "true") {
      const { state, version } = await browser.storage.local.get([
        "state",
        "version",
      ])

      if (state) {
        const restoredState = decodeJSON(state)
        if (typeof restoredState === "object" && restoredState !== null) {
          // If someone managed to sneak JSON that decodes to typeof "object"
          // but isn't a Record<string, unknown>, there is a very large
          // problem...
          savedReduxState = migrateReduxState(
            restoredState as Record<string, unknown>,
            version || undefined
          )
        } else {
          throw new Error(`Unexpected JSON persisted for state: ${state}`)
        }
      } else {
        // Should be false if you don't want new users to see the modal
        localStorageShim.setItem("modal_meet_pelagus", "false")
      }
    }

    return new this(
      savedReduxState,
      await preferenceService,
      await chainService,
      await enrichmentService,
      await indexingService,
      await keyringService,
      await nameService,
      await internalEthereumProviderService,
      await providerBridgeService,
      await telemetryService,
      await signingService,
      await analyticsService
    )
  }

  private constructor(
    savedReduxState: Record<string, unknown>,
    /**
     * A promise to the preference service, a dependency for most other services.
     * The promise will be resolved when the service is initialized.
     */
    private preferenceService: PreferenceService,
    /**
     * A promise to the chain service, keeping track of base asset balances,
     * transactions, and network status. The promise will be resolved when the
     * service is initialized.
     */
    public chainService: ChainService,
    /**
     *
     */
    private enrichmentService: EnrichmentService,
    /**
     * A promise to the indexing service, keeping track of token balances and
     * prices. The promise will be resolved when the service is initialized.
     */
    private indexingService: IndexingService,
    /**
     * A promise to the keyring service, which stores key material, derives
     * accounts, and signs messagees and transactions. The promise will be
     * resolved when the service is initialized.
     */
    private keyringService: KeyringService,
    /**
     * A promise to the name service, responsible for resolving names to
     * addresses and content.
     */
    private nameService: NameService,
    /**
     * A promise to the internal ethereum provider service, which acts as
     * web3 / ethereum provider for the internal and external dApps to use.
     */
    private internalEthereumProviderService: InternalEthereumProviderService,
    /**
     * A promise to the provider bridge service, handling and validating
     * the communication coming from dApps according to EIP-1193 and some tribal
     * knowledge.
     */
    private providerBridgeService: ProviderBridgeService,
    /**
     * A promise to the telemetry service, which keeps track of extension
     * storage usage and (eventually) other statistics.
     */
    private telemetryService: TelemetryService,

    /**
     * A promise to the signing service which will route operations between the UI
     * and the exact signing services.
     */
    private signingService: SigningService,

    /**
     * A promise to the analytics service which will be responsible for listening
     * to events and dispatching to our analytics backend
     */
    private analyticsService: AnalyticsService
  ) {
    super({
      initialLoadWaitExpired: {
        schedule: { delayInMinutes: 2.5 },
        handler: () => this.store.dispatch(initializationLoadingTimeHitLimit()),
      },
    })

    // Start up the redux store and set it up for proxying.
    this.store = initializeStore(savedReduxState, this)

    wrapStore(this.store, {
      serializer: encodeJSON,
      deserializer: decodeJSON,
      diffStrategy: deepDiff,
      dispatchResponder: async (
        dispatchResult: Promise<unknown>,
        send: (param: { error: string | null; value: unknown | null }) => void
      ) => {
        try {
          send({
            error: null,
            value: encodeJSON(await dispatchResult),
          })
        } catch (error) {
          logger.error(
            "Error awaiting and dispatching redux store result: ",
            error
          )
          send({
            error: encodeJSON(error),
            value: null,
          })
        }
      },
    })

    this.initializeRedux()
    this.UrlToProvider = new Map()
    globalThis.main = this
    this.ready = Promise.resolve(true)
  }

  async SetNetworkError(chainIdWithError: ChainIdWithError): Promise<void> {
    await this.ready
    await this.store.dispatch(setNewNetworkConnectError(chainIdWithError))
  }

  async startBalanceChecker(): Promise<void> {
    const interval = setInterval(async () => {
      if (!walletOpen) return

      // Also refresh the transactions in the account
      this.enrichActivitiesForSelectedAccount()

      const selectedAccount = await this.store.getState().ui.selectedAccount
      const currentAccountState = await this.store.getState().account
        .accountsData.evm[selectedAccount.network.chainID]?.[
        normalizeEVMAddress(selectedAccount.address)
      ]
      if (
        currentAccountState === undefined ||
        currentAccountState === "loading"
      )
        return

      const { balances } = currentAccountState
      for (const assetSymbol in balances) {
        const { asset } = balances[assetSymbol].assetAmount
        let newBalance = BigInt(0)
        if (isSmartContractFungibleAsset(asset)) {
          if (
            getShardFromAddress(asset.contractAddress) !==
            getShardFromAddress(selectedAccount.address)
          ) {
            continue
          }
          newBalance = (
            await this.chainService.assetData.getTokenBalance(
              selectedAccount,
              asset.contractAddress
            )
          ).amount
        } else if (isBuiltInNetworkBaseAsset(asset, selectedAccount.network)) {
          newBalance = (
            await this.chainService.getLatestBaseAccountBalance(selectedAccount)
          ).assetAmount.amount
        } else {
          logger.error(
            `Unknown asset type for balance checker, asset: ${asset.symbol}`
          )
          continue
        }
        isSmartContractFungibleAsset(asset)
          ? console.log(
              `Balance checker: ${asset.symbol} ${newBalance} ${asset.contractAddress}`
            )
          : console.log(`Balance checker: ${asset.symbol} ${newBalance}`)
        await this.store.dispatch(
          updateAccountBalance({
            balances: [
              {
                address: selectedAccount.address,
                assetAmount: {
                  amount: newBalance,
                  asset,
                },
                network: selectedAccount.network,
                retrievedAt: Date.now(),
                dataSource: "local",
              },
            ],
            addressOnNetwork: {
              address: selectedAccount.address,
              network: selectedAccount.network,
            },
          })
        )
      }
    }, 10000)
    this.balanceChecker = interval
  }

  async manuallyCheckBalances(): Promise<void> {
    const selectedAccount = await this.store.getState().ui.selectedAccount
    const currentAccountState = await this.store.getState().account.accountsData
      .evm[selectedAccount.network.chainID]?.[
      normalizeEVMAddress(selectedAccount.address)
    ]
    if (currentAccountState === undefined || currentAccountState === "loading")
      return

    const { balances } = currentAccountState
    for (const assetSymbol in balances) {
      const { asset } = balances[assetSymbol].assetAmount
      let newBalance = BigInt(0)
      if (isSmartContractFungibleAsset(asset)) {
        if (
          getShardFromAddress(asset.contractAddress) !==
          getShardFromAddress(selectedAccount.address)
        ) {
          continue
        }
        newBalance = (
          await this.chainService.assetData.getTokenBalance(
            selectedAccount,
            asset.contractAddress
          )
        ).amount
      } else if (isBuiltInNetworkBaseAsset(asset, selectedAccount.network)) {
        newBalance = (
          await this.chainService.getLatestBaseAccountBalance(selectedAccount)
        ).assetAmount.amount
      } else {
        logger.error(
          `Unknown asset type for balance checker, asset: ${asset.symbol}`
        )
        continue
      }
      isSmartContractFungibleAsset(asset)
        ? console.log(
            `Balance checker: ${asset.symbol} ${newBalance} ${asset.contractAddress}`
          )
        : console.log(`Balance checker: ${asset.symbol} ${newBalance}`)
      await this.store.dispatch(
        updateAccountBalance({
          balances: [
            {
              address: selectedAccount.address,
              assetAmount: {
                amount: newBalance,
                asset,
              },
              network: selectedAccount.network,
              retrievedAt: Date.now(),
              dataSource: "local",
            },
          ],
          addressOnNetwork: {
            address: selectedAccount.address,
            network: selectedAccount.network,
          },
        })
      )
    }
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService()

    const servicesToBeStarted = [
      this.preferenceService.startService(),
      this.chainService.startService(),
      this.indexingService.startService(),
      this.enrichmentService.startService(),
      this.keyringService.startService(),
      this.nameService.startService(),
      this.internalEthereumProviderService.startService(),
      this.providerBridgeService.startService(),
      this.telemetryService.startService(),
      this.signingService.startService(),
      this.analyticsService.startService(),
      this.startBalanceChecker(),
    ]

    await Promise.all(servicesToBeStarted)
  }

  protected override async internalStopService(): Promise<void> {
    const servicesToBeStopped = [
      this.preferenceService.stopService(),
      this.chainService.stopService(),
      this.indexingService.stopService(),
      this.enrichmentService.stopService(),
      this.keyringService.stopService(),
      this.nameService.stopService(),
      this.internalEthereumProviderService.stopService(),
      this.providerBridgeService.stopService(),
      this.telemetryService.stopService(),
      this.signingService.stopService(),
      this.analyticsService.stopService(),
      clearInterval(this.balanceChecker),
    ]

    await Promise.all(servicesToBeStopped)
    await super.internalStopService()
  }

  async initializeRedux(): Promise<void> {
    this.connectIndexingService()
    this.connectKeyringService()
    this.connectNameService()
    this.connectInternalEthereumProviderService()
    this.connectProviderBridgeService()
    this.connectPreferenceService()
    this.connectEnrichmentService()
    this.connectTelemetryService()
    this.connectSigningService()

    await this.connectChainService()

    // FIXME Should no longer be necessary once transaction queueing enters the
    this.store.dispatch(
      clearTransactionState(TransactionConstructionStatus.Idle)
    )

    this.connectPopupMonitor()
  }

  public GetShard(): string {
    const selectedAddress = this.store.getState().ui.selectedAccount.address
    if (selectedAddress === undefined || selectedAddress === "") {
      console.error("No selected address")
      return "cyprus-1"
    }
    return getShardFromAddress(selectedAddress)
  }

  public SetShard(shard: string): void {
    this.SelectedShard = shard
  }

  public SetCorrectShard(): void {
    const selectedAddress = this.store.getState().ui.selectedAccount.address
    if (selectedAddress === undefined || selectedAddress === "") {
      console.error("No selected address")
      this.SelectedShard = "cyprus-1"
      return
    }
    this.SelectedShard = getShardFromAddress(selectedAddress)
  }

  async addAccount(addressNetwork: AddressOnNetwork): Promise<void> {
    await this.chainService.addAccountToTrack(addressNetwork)
  }

  addOrEditAddressName({
    address,
    network,
    name,
  }: AddressOnNetwork & { name: string }): void {
    this.preferenceService.addOrEditNameInAddressBook({
      address,
      network,
      name,
    })
    this.analyticsService.sendAnalyticsEvent(AnalyticsEvent.ACCOUNT_NAME_EDITED)
  }

  async removeAccountActivity(address: HexString): Promise<void> {
    this.store.dispatch(removeActivities(address))
    await this.chainService.removeActivities(address)
  }

  async removeAccount(
    address: HexString,
    signer: AccountSigner,
    lastAddressInAccount: boolean
  ): Promise<void> {
    this.store.dispatch(deleteAccount(address))

    if (signer.type !== AccountType.ReadOnly && lastAddressInAccount) {
      await this.preferenceService.deleteAccountSignerSettings(signer)
    }

    this.store.dispatch(removeActivities(address))
    this.store.dispatch(revokePermissionsForAddress(address))
    await this.providerBridgeService.revokePermissionsForAddress(address)
    // TODO Adjust to handle specific network.
    await this.signingService.removeAccount(address, signer.type)

    this.nameService.removeAccount(address)
  }

  async getAccountEthBalanceUncached(
    addressNetwork: AddressOnNetwork
  ): Promise<bigint> {
    const accountBalance = await this.chainService.getLatestBaseAccountBalance(
      addressNetwork
    )

    return accountBalance.assetAmount.amount
  }

  async enrichActivitiesForSelectedAccount(): Promise<void> {
    const addressNetwork = this.store.getState().ui.selectedAccount
    if (addressNetwork) {
      await this.enrichActivities(addressNetwork)
    }
  }

  async enrichActivities(addressNetwork: AddressOnNetwork): Promise<void> {
    const activitiesToEnrich = selectActivitesHashesForEnrichment(
      this.store.getState()
    )
    // This a mint if the from address is '0x0000000000000000000000000000000000000000' and we enrich it as an ITX
    activitiesToEnrich.forEach(async ({ hash: txHash, status, to, from }) => {
      // Enrich ETX or ITX
      if (
        to &&
        getShardFromAddress(to) !== getShardFromAddress(from) &&
        from !== "0x0000000000000000000000000000000000000000"
      ) {
        await this.enrichETXActivity(addressNetwork, txHash, status, to)
      } else {
        await this.enrichITXActivity(addressNetwork, txHash, status)
      }
    })
  }

  async enrichITXActivity(
    addressNetwork: AddressOnNetwork,
    txHash: HexString,
    status: number | undefined
  ): Promise<void> {
    const accountsToTrack = await this.chainService.getAccountsToTrack()
    const transaction = await this.chainService.getTransaction(
      addressNetwork.network,
      txHash
    )
    if (!transaction) return

    const enrichedTransaction = await this.enrichmentService.enrichTransaction(
      transaction,
      2
    )

    this.store.dispatch(
      addActivity({
        transaction: {
          ...enrichedTransaction,
          status: status ?? transaction.blockHash ? 2 : -1,
        },
        forAccounts: getRelevantTransactionAddresses(
          enrichedTransaction,
          accountsToTrack
        ),
      })
    )
  }

  async enrichETXActivity(
    addressNetwork: AddressOnNetwork,
    txHash: HexString,
    status: number | undefined,
    to: string
  ): Promise<void> {
    const accountsToTrack = await this.chainService.getAccountsToTrack()
    const transaction = await this.chainService.getETX(
      addressNetwork.network,
      txHash,
      getShardFromAddress(to)
    )

    if (
      transaction.blockHash &&
      (!("etxs" in transaction) || transaction.etxs.length == 0)
    ) {
      console.warn("No ETXs emitted for tx: ", transaction.hash)
      return
    }

    if ("status" in transaction && transaction.status == status) {
      console.log(
        "ETX not yet found on destination chain: ",
        "etxs" in transaction ? transaction.etxs[0].hash : "No hash"
      )
      return // Nothing has changed since last enrichment
    }

    console.log(
      "Enriching again because status has changed",
      "status" in transaction ? transaction.status : "No status before - ",
      status
    )

    const enrichedTransaction = await this.enrichmentService.enrichTransaction(
      transaction,
      2
    )

    this.store.dispatch(
      addActivity({
        transaction: enrichedTransaction,
        forAccounts: getRelevantTransactionAddresses(
          enrichedTransaction,
          accountsToTrack
        ),
      })
    )
  }

  async connectChainService(): Promise<void> {
    // Initialize activities for all accounts once on and then
    // initialize for each account when it is needed
    this.chainService.emitter.on("initializeActivities", async (payload) => {
      this.store.dispatch(initializeActivities(payload))
      await this.enrichActivitiesForSelectedAccount()

      this.chainService.emitter.on(
        "initializeActivitiesForAccount",
        async (payloadForAccount) => {
          this.store.dispatch(initializeActivitiesForAccount(payloadForAccount))
          await this.enrichActivitiesForSelectedAccount()
        }
      )

      // Set up initial state.
      const existingAccounts = await this.chainService.getAccountsToTrack()
      existingAccounts.forEach(async (addressNetwork) => {
        // Mark as loading and wire things up.
        this.store.dispatch(loadAccount(addressNetwork))
        // Force a refresh of the account balance to populate the store.
        this.chainService.getLatestBaseAccountBalance(addressNetwork)
      })
    })

    // Wire up chain service to account slice.
    this.chainService.emitter.on(
      "accountsWithBalances",
      (accountWithBalance) => {
        // The first account balance update will transition the account to loading.
        this.store.dispatch(updateAccountBalance(accountWithBalance))
      }
    )

    this.chainService.emitter.on("supportedNetworks", (supportedNetworks) => {
      this.store.dispatch(setEVMNetworks(supportedNetworks))
    })

    this.chainService.emitter.on("block", (block) => {
      this.store.dispatch(blockSeen(block))
    })

    this.chainService.emitter.on("transactionSend", () => {
      this.store.dispatch(
        setSnackbarMessage("Transaction signed, broadcasting...")
      )
      this.store.dispatch(
        clearTransactionState(TransactionConstructionStatus.Idle)
      )
    })

    this.chainService.emitter.on("transactionSendFailure", () => {
      this.store.dispatch(
        setSnackbarMessage("Transaction failed to broadcast.")
      )
    })

    transactionConstructionSliceEmitter.on(
      "updateTransaction",
      async (transaction) => {
        const { network } = transaction

        const {
          values: { maxFeePerGas, maxPriorityFeePerGas },
        } = selectDefaultNetworkFeeSettings(this.store.getState())

        const { transactionRequest: populatedRequest, gasEstimationError } =
          await this.chainService.populatePartialTransactionRequest(
            network,
            { ...transaction },
            { maxFeePerGas, maxPriorityFeePerGas }
          )

        // Create promise to pass into Promise.race
        const getAnnotation = async () => {
          const { annotation } =
            await this.enrichmentService.enrichTransactionSignature(
              network,
              populatedRequest,
              2 /* TODO desiredDecimals should be configurable */
            )
          return annotation
        }

        const maybeEnrichedAnnotation = await Promise.race([
          getAnnotation(),
          // Wait 10 seconds before discarding enrichment
          wait(10_000),
        ])

        if (maybeEnrichedAnnotation) {
          populatedRequest.annotation = maybeEnrichedAnnotation
        }

        if (typeof gasEstimationError === "undefined") {
          this.store.dispatch(
            transactionRequest({
              transactionRequest: populatedRequest,
              transactionLikelyFails: false,
            })
          )
        } else {
          this.store.dispatch(
            transactionRequest({
              transactionRequest: populatedRequest,
              transactionLikelyFails: true,
            })
          )
        }
      }
    )

    transactionConstructionSliceEmitter.on(
      "broadcastSignedTransaction",
      async (transaction: SignedTransaction) => {
        this.chainService.broadcastSignedTransaction(transaction)
      }
    )

    transactionConstructionSliceEmitter.on(
      "requestSignature",
      async ({ request, accountSigner }) => {
        try {
          const signedTransactionResult =
            await this.signingService.signTransaction(request, accountSigner)
          await this.store.dispatch(transactionSigned(signedTransactionResult))
          setTimeout(
            () =>
              transactionConstructionSliceEmitter.emit(
                "signedTransactionResult",
                signedTransactionResult
              ),
            1000
          ) // could check broadcastOnSign here and broadcast if false but this is a hacky solution (could result in tx broadcasted twice)
          this.analyticsService.sendAnalyticsEvent(
            AnalyticsEvent.TRANSACTION_SIGNED,
            {
              chainId: request.chainID,
            }
          )
        } catch (exception) {
          logger.error("Error signing transaction", exception)
          this.store.dispatch(
            clearTransactionState(TransactionConstructionStatus.Idle)
          )
        }
      }
    )
    signingSliceEmitter.on(
      "requestSignTypedData",
      async ({ typedData, account, accountSigner }) => {
        try {
          const signedData = await this.signingService.signTypedData({
            typedData,
            account,
            accountSigner,
          })
          this.store.dispatch(signedTypedData(signedData))
        } catch (err) {
          logger.error("Error signing typed data", typedData, "error: ", err)
          this.store.dispatch(clearSigningState)
        }
      }
    )
    signingSliceEmitter.on(
      "requestSignData",
      async ({ rawSigningData, account, accountSigner }) => {
        const signedData = await this.signingService.signData(
          account,
          rawSigningData,
          accountSigner
        )
        this.store.dispatch(signedDataAction(signedData))
      }
    )

    this.chainService.emitter.on(
      "blockPrices",
      async ({ blockPrices, network }) => {
        this.store.dispatch(
          estimatedFeesPerGas({ estimatedFeesPerGas: blockPrices, network })
        )
      }
    )

    // Report on transactions for basic activity. Fancier stuff is handled via connectEnrichmentService
    this.chainService.emitter.on("transaction", async (transactionInfo) => {
      this.store.dispatch(addActivity(transactionInfo))
    })

    uiSliceEmitter.on("userActivityEncountered", (addressOnNetwork) => {
      this.chainService.markAccountActivity(addressOnNetwork)
    })
  }

  async connectNameService(): Promise<void> {
    this.nameService.emitter.on(
      "resolvedName",
      async ({
        from: { addressOnNetwork },
        resolved: {
          nameOnNetwork: { name },
        },
      }) => {
        this.store.dispatch(updateAccountName({ ...addressOnNetwork, name }))
      }
    )
  }

  async connectIndexingService(): Promise<void> {
    this.indexingService.emitter.on(
      "accountsWithBalances",
      async ({ balances, addressOnNetwork }) => {
        const assetsToTrack = await this.indexingService.getAssetsToTrack()
        const trackedAccounts = await this.chainService.getAccountsToTrack()
        const allTrackedAddresses = new Set(
          trackedAccounts.map((account) => account.address)
        )

        if (!allTrackedAddresses.has(addressOnNetwork.address)) return

        const filteredBalancesToDispatch: AccountBalance[] = []
        const sortedBalances: AccountBalance[] = []

        balances
          .filter((balance) => {
            const isSmartContract =
              "contractAddress" in balance.assetAmount.asset

            if (!isSmartContract) {
              sortedBalances.push(balance)
            }

            // Network base assets with smart contract addresses from some networks
            // token balances but they should not be handled here as they would
            // not be correctly treated as base assets
            if (
              isBuiltInNetworkBaseAsset(
                balance.assetAmount.asset,
                balance.network
              )
            )
              return false

            return isSmartContract
          })
          // Sort verified last to prevent shadowing assets from token lists
          // FIXME: Balances should not be indexed by symbol in redux
          .sort((balance, otherBalance) => {
            const asset = balance.assetAmount.asset as SmartContractAsset
            const other = otherBalance.assetAmount.asset as SmartContractAsset

            return (
              (other.metadata?.tokenLists?.length ?? 0) -
              (asset.metadata?.tokenLists?.length ?? 0)
            )
          })
          .forEach((balance) => sortedBalances.unshift(balance))

        sortedBalances.forEach((balance) => {
          // TODO support multi-network assets
          const balanceHasAnAlreadyTrackedAsset = assetsToTrack.some(
            (tracked) =>
              tracked.symbol === balance.assetAmount.asset.symbol &&
              isSmartContractFungibleAsset(balance.assetAmount.asset) &&
              normalizeEVMAddress(tracked.contractAddress) ===
                normalizeEVMAddress(balance.assetAmount.asset.contractAddress)
          )

          if (
            balance.assetAmount.amount > 0 ||
            balanceHasAnAlreadyTrackedAsset
          ) {
            filteredBalancesToDispatch.push(balance)
          }
        })

        this.store.dispatch(
          updateAccountBalance({
            balances: filteredBalancesToDispatch,
            addressOnNetwork,
          })
        )
      }
    )

    this.indexingService.emitter.on("assets", async (assets) => {
      await this.store.dispatch(assetsLoaded(assets))
    })

    this.indexingService.emitter.on("refreshAsset", (asset) => {
      this.store.dispatch(
        refreshAsset({
          asset,
        })
      )
    })

    this.indexingService.emitter.on("removeAssetData", (asset) => {
      this.store.dispatch(removeAssetData({ asset }))
    })
  }

  async connectEnrichmentService(): Promise<void> {
    this.enrichmentService.emitter.on(
      "enrichedEVMTransaction",
      (transactionData) => {
        this.indexingService.notifyEnrichedTransaction(
          transactionData.transaction
        )
        this.store.dispatch(addActivity(transactionData))
      }
    )
  }

  async connectSigningService(): Promise<void> {
    this.keyringService.emitter.on("address", (address) =>
      this.signingService.addTrackedAddress(address, "keyring")
    )
  }

  async connectKeyringService(): Promise<void> {
    this.keyringService.emitter.on("keyrings", (keyrings) => {
      this.store.dispatch(updateKeyrings(keyrings))
    })

    this.keyringService.emitter.on("address", async (address) => {
      const trackedNetworks = await this.chainService.getTrackedNetworks()
      trackedNetworks.forEach((network) => {
        // Mark as loading and wire things up.
        this.store.dispatch(
          loadAccount({
            address,
            network,
          })
        )

        this.chainService.addAccountToTrack({
          address,
          network,
        })
      })
    })

    this.keyringService.emitter.on("locked", async (isLocked) => {
      if (isLocked) {
        this.store.dispatch(keyringLocked())
      } else {
        this.store.dispatch(keyringUnlocked())
      }
    })

    keyringSliceEmitter.on("createPassword", async (password) => {
      await this.keyringService.unlock(password, true)
    })

    keyringSliceEmitter.on("lockKeyrings", async () => {
      await this.keyringService.lock()
    })

    keyringSliceEmitter.on("deriveAddress", async (keyringData) => {
      await this.signingService.deriveAddress({
        type: "keyring",
        keyringID: keyringData.signerId,
        shard: keyringData.shard,
      })
    })

    keyringSliceEmitter.on("generateNewKeyring", async (path) => {
      // TODO move unlocking to a reasonable place in the initialization flow
      const generated: {
        id: string
        mnemonic: string[]
      } = await this.keyringService.generateNewKeyring(
        KeyringTypes.mnemonicBIP39S256,
        path
      )

      this.store.dispatch(setKeyringToVerify(generated))
    })
  }

  async connectInternalEthereumProviderService(): Promise<void> {
    this.internalEthereumProviderService.emitter.on(
      "transactionSignatureRequest",
      async ({ payload, resolver, rejecter }) => {
        await this.signingService.prepareForSigningRequest()

        this.store.dispatch(
          clearTransactionState(TransactionConstructionStatus.Pending)
        )
        this.store.dispatch(updateTransactionData(payload))

        const clear = () => {
          // Mutual dependency to handleAndClear.
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          this.signingService.emitter.off("signingTxResponse", handleAndClear)

          transactionConstructionSliceEmitter.off(
            "signatureRejected",
            // Mutual dependency to rejectAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            rejectAndClear
          )
        }

        const handleAndClear = (response: TXSignatureResponse) => {
          clear()
          switch (response.type) {
            case "success-tx":
              resolver(response.signedTx)
              break
            default:
              rejecter()
              break
          }
        }

        const rejectAndClear = () => {
          clear()
          rejecter()
        }

        this.signingService.emitter.on("signingTxResponse", handleAndClear)

        transactionConstructionSliceEmitter.on(
          "signatureRejected",
          rejectAndClear
        )
      }
    )
    this.internalEthereumProviderService.emitter.on(
      "signTypedDataRequest",
      async ({
        payload,
        resolver,
        rejecter,
      }: {
        payload: SignTypedDataRequest
        resolver: (result: string | PromiseLike<string>) => void
        rejecter: () => void
      }) => {
        // Run signer preparation and enrichment in parallel.
        const [, enrichedSignTypedDataRequest] = await Promise.all([
          this.signingService.prepareForSigningRequest(),
          this.enrichmentService.enrichSignTypedDataRequest(payload),
        ])

        this.store.dispatch(typedDataRequest(enrichedSignTypedDataRequest))

        const clear = () => {
          this.signingService.emitter.off(
            "signingDataResponse",
            // Mutual dependency to handleAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            handleAndClear
          )

          signingSliceEmitter.off(
            "signatureRejected",
            // Mutual dependency to rejectAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            rejectAndClear
          )
        }

        const handleAndClear = (response: SignatureResponse) => {
          clear()
          switch (response.type) {
            case "success-data":
              resolver(response.signedData)
              break
            default:
              rejecter()
              break
          }
        }

        const rejectAndClear = () => {
          clear()
          rejecter()
        }

        this.signingService.emitter.on("signingDataResponse", handleAndClear)

        signingSliceEmitter.on("signatureRejected", rejectAndClear)
      }
    )
    this.internalEthereumProviderService.emitter.on(
      "signDataRequest",
      async ({
        payload,
        resolver,
        rejecter,
      }: {
        payload: MessageSigningRequest
        resolver: (result: string | PromiseLike<string>) => void
        rejecter: () => void
      }) => {
        await this.signingService.prepareForSigningRequest()

        this.chainService.pollBlockPricesForNetwork(
          payload.account.network.chainID
        )
        this.store.dispatch(signDataRequest(payload))

        const clear = () => {
          this.signingService.emitter.off(
            "personalSigningResponse",
            // Mutual dependency to handleAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            handleAndClear
          )

          signingSliceEmitter.off(
            "signatureRejected",
            // Mutual dependency to rejectAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            rejectAndClear
          )
        }

        const handleAndClear = (response: SignatureResponse) => {
          clear()
          switch (response.type) {
            case "success-data":
              resolver(response.signedData)
              break
            default:
              rejecter()
              break
          }
        }

        const rejectAndClear = () => {
          clear()
          rejecter()
        }

        this.signingService.emitter.on(
          "personalSigningResponse",
          handleAndClear
        )

        signingSliceEmitter.on("signatureRejected", rejectAndClear)
      }
    )
    this.internalEthereumProviderService.emitter.on(
      "selectedNetwork",
      (network) => {
        this.store.dispatch(setSelectedNetwork(network))
      }
    )

    uiSliceEmitter.on("newSelectedNetwork", (network) => {
      this.internalEthereumProviderService.routeSafeRPCRequest(
        "wallet_switchEthereumChain",
        [{ chainId: network.chainID }],
        PELAGUS_INTERNAL_ORIGIN
      )
      this.chainService.pollBlockPricesForNetwork(network.chainID)
      this.store.dispatch(clearCustomGas())
    })

    this.internalEthereumProviderService.emitter.on(
      "watchAssetRequest",
      async ({ contractAddress, network }) => {
        const { address } = this.store.getState().ui.selectedAccount
        const asset = await this.indexingService.addTokenToTrackByContract(
          network,
          contractAddress
        )
        if (asset) {
          await this.indexingService.retrieveTokenBalances(
            {
              address,
              network,
            },
            [asset]
          )
        }
      }
    )
  }

  async connectProviderBridgeService(): Promise<void> {
    uiSliceEmitter.on("addCustomNetworkResponse", ([requestId, success]) => {
      return this.providerBridgeService.handleAddNetworkRequest(
        requestId,
        success
      )
    })

    this.providerBridgeService.emitter.on(
      "requestPermission",
      (permissionRequest: PermissionRequest) => {
        this.store.dispatch(requestPermission(permissionRequest))
      }
    )

    this.providerBridgeService.emitter.on(
      "initializeAllowedPages",
      async (allowedPages: PermissionMap) => {
        this.store.dispatch(initializePermissions(allowedPages))
      }
    )

    providerBridgeSliceEmitter.on("grantPermission", async (permission) => {
      this.analyticsService.sendAnalyticsEvent(AnalyticsEvent.DAPP_CONNECTED, {
        origin: permission.origin,
        chainId: permission.chainID,
      })
      await Promise.all(
        this.chainService.supportedNetworks.map(async (network) => {
          await this.providerBridgeService.grantPermission({
            ...permission,
            chainID: network.chainID,
          })
        })
      )
    })

    providerBridgeSliceEmitter.on(
      "denyOrRevokePermission",
      async (permission) => {
        await Promise.all(
          this.chainService.supportedNetworks.map(async (network) => {
            await this.providerBridgeService.denyOrRevokePermission({
              ...permission,
              chainID: network.chainID,
            })
          })
        )
      }
    )

    providerBridgeSliceEmitter.on(
      "denyDAppPermissions",
      async (permissions: PermissionRequest[]) => {
        await Promise.all(
          permissions.map(async (permission) => {
            await Promise.all(
              this.chainService.supportedNetworks.map(async (network) => {
                await this.providerBridgeService.denyDAppPermission({
                  ...permission,
                  chainID: network.chainID,
                })
              })
            )
          })
        )
      }
    )

    providerBridgeSliceEmitter.on(
      "denyDAppPermissionForAddress",
      async ({ permission, accountAddress }) => {
        await Promise.all(
          this.chainService.supportedNetworks.map(async (network) => {
            await this.providerBridgeService.denyDAppPermissionForAddress(
              {
                ...permission,
                chainID: network.chainID,
              },
              accountAddress
            )
          })
        )
      }
    )
  }

  async connectPreferenceService(): Promise<void> {
    this.preferenceService.emitter.on(
      "initializeDefaultWallet",
      async (isDefaultWallet: boolean) => {
        await this.store.dispatch(setDefaultWallet(isDefaultWallet))
      }
    )

    this.preferenceService.emitter.on(
      "showDefaultWalletBanner",
      async (isHiddenDefaultWalletBanner: boolean) => {
        this.store.dispatch(
          setShowDefaultWalletBanner(isHiddenDefaultWalletBanner)
        )
      }
    )

    this.preferenceService.emitter.on(
      "initializeSelectedAccount",
      async (dbAddressNetwork: AddressOnNetwork) => {
        if (dbAddressNetwork) {
          // TBD: naming the normal reducer and async thunks
          // Initialize redux from the db
          // !!! Important: this action belongs to a regular reducer.
          // NOT to be confused with the setNewCurrentAddress asyncThunk
          this.store.dispatch(setSelectedAccount(dbAddressNetwork))
        } else {
          // Update currentAddress in db if it's not set but it is in the store
          // should run only one time
          const addressNetwork = this.store.getState().ui.selectedAccount

          if (addressNetwork) {
            await this.preferenceService.setSelectedAccount(addressNetwork)
          }
        }
      }
    )

    this.preferenceService.emitter.on(
      "updatedSignerSettings",
      (accountSignerSettings) => {
        this.store.dispatch(setAccountsSignerSettings(accountSignerSettings))
      }
    )

    uiSliceEmitter.on(
      "showDefaultWalletBanner",
      async (isHiddenDefaultWalletBanner: boolean) => {
        await this.preferenceService.setShowDefaultWalletBanner(
          isHiddenDefaultWalletBanner
        )
      }
    )

    uiSliceEmitter.on("newSelectedAccount", async (addressNetwork) => {
      await this.preferenceService.setSelectedAccount(addressNetwork)

      await this.chainService.markAccountActivity(addressNetwork)

      this.providerBridgeService.notifyContentScriptsAboutAddressChange(
        addressNetwork.address
      )
    })

    uiSliceEmitter.on("newSelectedAccountSwitched", async (addressNetwork) => {
      this.enrichActivities(addressNetwork)
    })

    uiSliceEmitter.on(
      "newDefaultWalletValue",
      async (newDefaultWalletValue) => {
        await this.preferenceService.setDefaultWalletValue(
          newDefaultWalletValue
        )

        this.providerBridgeService.notifyContentScriptAboutConfigChange(
          newDefaultWalletValue
        )
        this.analyticsService.sendAnalyticsEvent(
          AnalyticsEvent.DEFAULT_WALLET_TOGGLED,
          {
            setToDefault: newDefaultWalletValue,
          }
        )
      }
    )

    uiSliceEmitter.on("refreshBackgroundPage", async () => {
      window.location.reload()
    })
  }

  connectTelemetryService(): void {
    // Pass the redux store to the telemetry service so we can analyze its size
    this.telemetryService.connectReduxStore(this.store)
  }

  async unlockKeyrings(password: string): Promise<boolean> {
    return this.keyringService.unlock(password)
  }

  async exportPrivKey(address: string): Promise<string> {
    return this.keyringService.exportPrivKey(address)
  }

  async importSigner(signerRaw: SignerImportMetadata): Promise<string | null> {
    return this.keyringService.importKeyring(signerRaw)
  }

  async getActivityDetails(txHash: string): Promise<ActivityDetail[]> {
    const addressNetwork = this.store.getState().ui.selectedAccount
    const transaction = await this.chainService.getTransaction(
      addressNetwork.network,
      txHash
    )
    if (!transaction) return []

    const enrichedTransaction = await this.enrichmentService.enrichTransaction(
      transaction,
      2
    )

    return getActivityDetails(enrichedTransaction)
  }

  async connectAnalyticsService(): Promise<void> {
    this.analyticsService.emitter.on("enableDefaultOn", () => {
      this.store.dispatch(setShowAnalyticsNotification(true))
    })

    this.chainService.emitter.on("networkSubscribed", (network) => {
      this.analyticsService.sendOneTimeAnalyticsEvent(
        OneTimeAnalyticsEvent.CHAIN_ADDED,
        {
          chainId: network.chainID,
          name: network.name,
          description: `This event is fired when a chain is subscribed to from the wallet for the first time.`,
        }
      )
    })

    // ⚠️ Note: We NEVER send addresses to analytics!
    this.chainService.emitter.on("newAccountToTrack", () => {
      this.analyticsService.sendAnalyticsEvent(
        AnalyticsEvent.NEW_ACCOUNT_TO_TRACK,
        {
          description: `
                This event is fired when any address on a network is added to the tracked list. 
                
                Note: this does not track recovery phrase(ish) import! But when an address is used 
                on a network for the first time (read-only or recovery phrase/keyring).
                `,
        }
      )
    })

    this.chainService.emitter.on("customChainAdded", (chainInfo) => {
      this.analyticsService.sendAnalyticsEvent(
        AnalyticsEvent.CUSTOM_CHAIN_ADDED,
        {
          description: `
                This event is fired when a custom chain is added to the wallet.
                `,
          chainInfo: chainInfo.chainName,
          chainId: chainInfo.chainId,
        }
      )
    })

    this.preferenceService.emitter.on(
      "updateAnalyticsPreferences",
      async (analyticsPreferences: AnalyticsPreferences) => {
        // This event is used on initialization and data change
        this.store.dispatch(
          toggleCollectAnalytics(
            // we are using only this field on the UI atm
            // it's expected that more detailed analytics settings will come
            analyticsPreferences.isEnabled
          )
        )

        this.analyticsService.sendAnalyticsEvent(
          AnalyticsEvent.ANALYTICS_TOGGLED,
          {
            analyticsEnabled: analyticsPreferences.isEnabled,
          }
        )
      }
    )

    uiSliceEmitter.on(
      "updateAnalyticsPreferences",
      async (analyticsPreferences: Partial<AnalyticsPreferences>) => {
        await this.preferenceService.updateAnalyticsPreferences(
          analyticsPreferences
        )
      }
    )

    uiSliceEmitter.on("deleteAnalyticsData", () => {
      this.analyticsService.removeAnalyticsData()
    })

    uiSliceEmitter.on("sendEvent", (event) => {
      if (isOneTimeAnalyticsEvent(event)) {
        this.analyticsService.sendOneTimeAnalyticsEvent(event)
      } else {
        this.analyticsService.sendAnalyticsEvent(event)
      }
    })
  }

  async updateAssetMetadata(
    asset: SmartContractFungibleAsset,
    metadata: AnyAssetMetadata
  ): Promise<void> {
    await this.indexingService.updateAssetMetadata(asset, metadata)
  }

  async hideAsset(asset: SmartContractFungibleAsset): Promise<void> {
    await this.indexingService.hideAsset(asset)
  }

  getAddNetworkRequestDetails(requestId: string): AddChainRequestData {
    return this.providerBridgeService.getNewCustomRPCDetails(requestId)
  }

  async updateSignerTitle(
    signer: AccountSignerWithId,
    title: string
  ): Promise<void> {
    return this.preferenceService.updateAccountSignerTitle(signer, title)
  }

  async resolveNameOnNetwork(
    nameOnNetwork: NameOnNetwork
  ): Promise<AddressOnNetwork | undefined> {
    try {
      return (await this.nameService.lookUpEthereumAddress(nameOnNetwork))
        ?.resolved?.addressOnNetwork
    } catch (error) {
      logger.info("Error looking up Ethereum address: ", error)
      return undefined
    }
  }

  async removeEVMNetwork(chainID: string): Promise<void> {
    // Per origin chain id settings
    await this.internalEthereumProviderService.removePrefererencesForChain(
      chainID
    )
    // Connected dApps
    await this.providerBridgeService.revokePermissionsForChain(chainID)
    await this.chainService.removeCustomChain(chainID)
  }

  async queryCustomTokenDetails(
    contractAddress: NormalizedEVMAddress,
    addressOnNetwork: AddressOnNetwork
  ): Promise<{
    asset: SmartContractFungibleAsset
    amount: bigint
    mainCurrencyAmount?: number
    balance: number
    exists?: boolean
  }> {
    const { network } = addressOnNetwork

    const cachedAsset = this.indexingService
      .getCachedAssets(network)
      .find(
        (asset): asset is SmartContractFungibleAsset =>
          isSmartContractFungibleAsset(asset) &&
          sameEVMAddress(contractAddress, asset.contractAddress)
      )

    const assetData = await this.chainService.queryAccountTokenDetails(
      contractAddress,
      addressOnNetwork,
      cachedAsset
    )

    return {
      ...assetData,
      balance: Number.parseFloat(
        utils.formatUnits(assetData.amount, assetData.asset.decimals)
      ),
      mainCurrencyAmount: undefined,
      exists: !!cachedAsset,
    }
  }

  async importCustomToken(asset: SmartContractFungibleAsset): Promise<boolean> {
    return this.indexingService.importCustomToken(asset)
  }

  private connectPopupMonitor() {
    runtime.onConnect.addListener((port) => {
      if (port.name !== popupMonitorPortName) return
      console.log("Pelagus Connected")

      walletOpen = true
      this.manuallyCheckBalances()

      const openTime = Date.now()

      const originalNetworkName =
        this.store.getState().ui.selectedAccount.network.name

      port.onDisconnect.addListener(() => {
        const networkNameAtClose =
          this.store.getState().ui.selectedAccount.network.name
        this.analyticsService.sendAnalyticsEvent(AnalyticsEvent.UI_SHOWN, {
          openTime: new Date(openTime).toISOString(),
          closeTime: new Date().toISOString(),
          openLength: (Date.now() - openTime) / 1e3,
          networkName:
            originalNetworkName === networkNameAtClose
              ? originalNetworkName
              : "switched networks",
          unit: "s",
        })
        walletOpen = false
        console.log("Pelagus Disconnected")
        this.onPopupDisconnected()
      })
    })
  }

  private onPopupDisconnected() {
    this.store.dispatch(rejectTransactionSignature())
    this.store.dispatch(rejectDataSignature())
  }
}
