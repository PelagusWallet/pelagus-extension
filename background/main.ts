import browser, { runtime } from "webextension-polyfill"
import { alias, wrapStore } from "webext-redux"
import deepDiff from "webext-redux/lib/strategies/deepDiff/diff"
import { configureStore, isPlain, Middleware } from "@reduxjs/toolkit"
import { devToolsEnhancer } from "@redux-devtools/remote"
import { PermissionRequest } from "@pelagus-provider/provider-bridge-shared"
import { debounce } from "lodash"
import {
  formatUnits,
  JsonRpcProvider,
  QuaiTransaction,
  WebSocketProvider,
} from "quais"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
import { decodeJSON, encodeJSON, sameQuaiAddress } from "./lib/utils"
import {
  AnalyticsService,
  BaseService,
  ChainService,
  EnrichmentService,
  IndexingService,
  InternalQuaiProviderService,
  KeyringService,
  NameService,
  PreferenceService,
  ProviderBridgeService,
  ServiceCreatorFunction,
  SigningService,
  TelemetryService,
} from "./services"
import { HexString } from "./types"
import { ChainIdWithError } from "./networks"
import {
  AccountBalance,
  AccountSignerWithId,
  AddressOnNetwork,
  NameOnNetwork,
} from "./accounts"
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
  setKeyringToVerify,
  updateKeyrings,
} from "./redux-slices/keyrings"
import {
  blockSeen,
  setEVMNetworks,
  updateNetwork,
} from "./redux-slices/networks"
import {
  emitter as uiSliceEmitter,
  initializationLoadingTimeHitLimit,
  resetSnackbarConfig,
  setAccountsSignerSettings,
  setDefaultWallet,
  setNewNetworkConnectError,
  setSelectedAccount,
  setSelectedNetwork,
  setShowAlphaWalletBanner,
  setShowAnalyticsNotification,
  setShowDefaultWalletBanner,
  setSnackbarConfig,
  toggleCollectAnalytics,
  toggleTestNetworks,
} from "./redux-slices/ui"
import {
  clearCustomGas,
  clearTransactionState,
  emitter as transactionConstructionSliceEmitter,
  estimatedFeesPerGas,
  quaiTransactionResponse,
  rejectTransactionSignature,
  TransactionConstructionStatus,
  transactionRequest,
  transactionSigned,
  updateTransactionData,
} from "./redux-slices/transaction-construction"
import { allAliases } from "./redux-slices/utils"
import {
  emitter as providerBridgeSliceEmitter,
  initializePermissions,
  requestPermission,
  revokePermissionsForAddress,
} from "./redux-slices/dapp"
import logger from "./lib/logger"
import {
  clearSigningState,
  rejectDataSignature,
  signDataRequest,
  signedData as signedDataAction,
  signedTypedData,
  signingSliceEmitter,
  typedDataRequest,
} from "./redux-slices/signing"
import { MessageSigningRequest, SignTypedDataRequest } from "./utils/signing"
import {
  AccountSigner,
  SignatureResponse,
  SignTransactionResponse,
} from "./services/signing"
import {
  migrateReduxState,
  REDUX_STATE_VERSION,
} from "./redux-slices/migrations"
import { PermissionMap } from "./services/provider-bridge/utils"
import { PELAGUS_INTERNAL_ORIGIN } from "./services/internal-quai-provider/constants"
import {
  ActivityDetail,
  addActivity,
  initializeActivities,
  initializeActivitiesForAccount,
  removeActivities,
} from "./redux-slices/activities"
import { selectActivitiesHashesForEnrichment } from "./redux-slices/selectors"
import { getActivityDetails } from "./redux-slices/utils/activities-utils"
import { getRelevantTransactionAddresses } from "./services/enrichment/utils"
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
import {
  bigIntToDecimal,
  isBuiltInNetworkBaseAsset,
} from "./redux-slices/utils/asset-utils"
import localStorageShim from "./utils/local-storage-shim"
import { getExtendedZoneForAddress } from "./services/chain/utils"
import { NetworkInterface } from "./constants/networks/networkTypes"
import { SignerImportMetadata } from "./services/keyring/types"
import {
  DEFAULT_PELAGUS_NETWORK,
  NetworksArray,
} from "./constants/networks/networks"
import ProviderFactory from "./services/provider-factory/provider-factory"
import { LocalNodeNetworkStatusEventTypes } from "./services/provider-factory/events"
import NotificationsManager from "./services/notifications"
import BlockService from "./services/block"
import TransactionService from "./services/transactions"

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

export let walletOpen = false

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

  public UrlToProvider: Map<string, JsonRpcProvider | WebSocketProvider>

  public ready: Promise<boolean>

  balanceChecker: NodeJS.Timeout

  static create: ServiceCreatorFunction<never, Main, []> = async () => {
    const preferenceService = PreferenceService.create()
    const providerFactoryService = ProviderFactory.create()
    const keyringService = KeyringService.create()
    const chainService = ChainService.create(
      providerFactoryService,
      preferenceService,
      keyringService
    )
    const blockService = BlockService.create(chainService, preferenceService)
    const transactionService = TransactionService.create(
      chainService,
      keyringService
    )
    const indexingService = IndexingService.create(
      preferenceService,
      chainService,
      blockService
    )
    const nameService = NameService.create(chainService, preferenceService)
    const enrichmentService = EnrichmentService.create(
      chainService,
      indexingService,
      nameService,
      blockService
    )
    const internalQuaiProviderService = InternalQuaiProviderService.create(
      chainService,
      preferenceService
    )
    const providerBridgeService = ProviderBridgeService.create(
      internalQuaiProviderService,
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
      await providerFactoryService,
      await preferenceService,
      await chainService,
      await enrichmentService,
      await indexingService,
      await keyringService,
      await nameService,
      await internalQuaiProviderService,
      await providerBridgeService,
      await telemetryService,
      await signingService,
      await analyticsService,
      await blockService,
      await transactionService
    )
  }

  private constructor(
    savedReduxState: Record<string, unknown>,
    public providerFactoryService: ProviderFactory,
    /**
     * A promise to the preference service, a dependency for most other services.
     * The promise will be resolved when the service is initialized.
     */
    public preferenceService: PreferenceService,
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
     * A promise to the internal quai provider service, which acts as
     * web3 / quai provider for the internal and external dApps to use.
     */
    private internalQuaiProviderService: InternalQuaiProviderService,
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
    private analyticsService: AnalyticsService,

    private blockService: BlockService,

    private transactionService: TransactionService
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

      const { selectedAccount } = this.store.getState().ui
      const currentAccountState =
        this.store.getState().account.accountsData.evm[
          selectedAccount.network.chainID
        ]?.[selectedAccount.address]
      if (
        currentAccountState === undefined ||
        currentAccountState === "loading"
      )
        return

      const { balances } = currentAccountState
      for (const assetSymbol in balances) {
        const { asset, amount } = balances[assetSymbol].assetAmount
        let newBalance = BigInt(0)
        if (isSmartContractFungibleAsset(asset)) {
          if (
            getExtendedZoneForAddress(asset.contractAddress, false) !==
            getExtendedZoneForAddress(selectedAccount.address, false)
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
        // isSmartContractFungibleAsset(asset)
        //   ? logger.info(
        //       `Balance checker: ${asset.symbol} ${newBalance} ${asset.contractAddress}`
        //     )
        //   : logger.info(`Balance checker: ${asset.symbol} ${newBalance}`)

        if (newBalance > amount && !this.keyringService.isLocked()) {
          const parsedAmount = bigIntToDecimal(newBalance - amount)
          NotificationsManager.createIncomingAssetsNotification(
            parsedAmount,
            asset.symbol,
            selectedAccount.address
          )
        }
        this.store.dispatch(
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
      .evm[selectedAccount.network.chainID]?.[selectedAccount.address]
    if (currentAccountState === undefined || currentAccountState === "loading")
      return

    const { balances } = currentAccountState
    for (const assetSymbol in balances) {
      const { asset } = balances[assetSymbol].assetAmount
      let newBalance = BigInt(0)
      if (isSmartContractFungibleAsset(asset)) {
        if (
          getExtendedZoneForAddress(asset.contractAddress, false) !==
          getExtendedZoneForAddress(selectedAccount.address, false)
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
        ? logger.info(
            `Balance checker: ${asset.symbol} ${newBalance} ${asset.contractAddress}`
          )
        : logger.info(`Balance checker: ${asset.symbol} ${newBalance}`)
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
      this.providerFactoryService.startService(),
      this.chainService.startService(),
      this.indexingService.startService(),
      this.enrichmentService.startService(),
      this.keyringService.startService(),
      this.nameService.startService(),
      this.internalQuaiProviderService.startService(),
      this.providerBridgeService.startService(),
      this.telemetryService.startService(),
      this.signingService.startService(),
      this.analyticsService.startService(),
      this.transactionService.startService(),
      this.startBalanceChecker(),
    ]

    // TODO need to rewrite Promise.all(),
    //  because it runs each promise "concurrently" and if we have service that relies,
    //  on another service we need to be careful of initialization order and forcefully wait
    await Promise.all(servicesToBeStarted)
    await this.transactionService.startService()
  }

  protected override async internalStopService(): Promise<void> {
    const servicesToBeStopped = [
      this.preferenceService.stopService(),
      this.providerFactoryService.stopService(),
      this.chainService.stopService(),
      this.indexingService.stopService(),
      this.enrichmentService.stopService(),
      this.keyringService.stopService(),
      this.nameService.stopService(),
      this.internalQuaiProviderService.stopService(),
      this.providerBridgeService.stopService(),
      this.telemetryService.stopService(),
      this.signingService.stopService(),
      this.analyticsService.stopService(),
      this.transactionService.stopService(),
      clearInterval(this.balanceChecker),
    ]

    await Promise.all(servicesToBeStopped)
    await super.internalStopService()
  }

  async initializeRedux(): Promise<void> {
    this.connectPreferenceService()
    this.connectProviderFactoryService()
    this.connectIndexingService()
    this.connectKeyringService()
    this.connectNameService()
    this.connectInternalQuaiProviderService()
    this.connectProviderBridgeService()
    this.connectEnrichmentService()
    this.connectTelemetryService()

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
      return "cyprus-1"
    }
    return getExtendedZoneForAddress(selectedAddress)
  }

  public SetShard(shard: string): void {
    this.SelectedShard = shard
  }

  public SetCorrectShard(): void {
    const selectedAddress = this.store.getState().ui.selectedAccount.address
    if (selectedAddress === undefined || selectedAddress === "") {
      logger.error("No selected address")
      this.SelectedShard = "cyprus-1"
      return
    }
    this.SelectedShard = getExtendedZoneForAddress(selectedAddress)
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

  async enrichActivitiesForSelectedAccount(): Promise<void> {
    await this.enrichActivities()
  }

  async enrichActivities(): Promise<void> {
    const activitiesToEnrich = selectActivitiesHashesForEnrichment(
      this.store.getState()
    )

    // This a mint if the from address is '0x0000000000000000000000000000000000000000' and we enrich it as an ITX
    await Promise.all(
      activitiesToEnrich.map(async (activity) => {
        const { hash: txHash, to = "", from } = activity

        if (
          getExtendedZoneForAddress(to, false) !==
            getExtendedZoneForAddress(from, false) &&
          from !== "0x0000000000000000000000000000000000000000"
        ) {
          await this.enrichETXActivity(txHash)
        } else {
          await this.enrichITXActivity(txHash)
        }
      })
    )
  }

  async enrichITXActivity(txHash: HexString): Promise<void> {
    const accountsToTrack = await this.chainService.getAccountsToTrack()
    const transaction = await this.chainService.getTransaction(txHash)
    if (!transaction) return

    const enrichedTransaction = await this.enrichmentService.enrichTransaction(
      transaction,
      2
    )

    this.store.dispatch(
      addActivity({
        transaction: {
          ...enrichedTransaction,
        },
        forAccounts: getRelevantTransactionAddresses(
          enrichedTransaction,
          accountsToTrack
        ),
      })
    )
  }

  async enrichETXActivity(txHash: HexString): Promise<void> {
    const accountsToTrack = await this.chainService.getAccountsToTrack()
    const transaction = await this.chainService.getTransaction(txHash)

    if (transaction?.blockHash && !transaction?.etxs?.length) {
      logger.warn("No ETXs emitted for tx: ", transaction?.hash)
      return
    }

    logger.info("Enriching again because status has changed")

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

  async signAndSendQuaiTransaction({
    request,
    accountSigner,
  }: {
    request: QuaiTransactionRequest
    accountSigner: AccountSigner
  }): Promise<boolean> {
    try {
      const transactionResponse =
        await this.signingService.signAndSendQuaiTransaction(
          request,
          accountSigner
        )

      await this.analyticsService.sendAnalyticsEvent(
        AnalyticsEvent.TRANSACTION_SIGNED,
        {
          chainId: transactionResponse.chainId,
        }
      )

      this.store.dispatch(quaiTransactionResponse(transactionResponse))

      return true
    } catch (exception) {
      this.store.dispatch(
        clearTransactionState(TransactionConstructionStatus.Idle)
      )
      return false
    }
  }

  async connectChainService(): Promise<void> {
    // Initialize activities for all accounts once on and then
    // initialize for each account when it is needed
    this.chainService.emitter.on("initializeActivities", async (payload) => {
      this.store.dispatch(initializeActivities(payload))
      await this.enrichActivitiesForSelectedAccount()

      // Set up initial state.
      const existingAccounts = await this.chainService.getAccountsToTrack()
      existingAccounts.forEach((addressNetwork) => {
        // Mark as loading and wire things up.
        this.store.dispatch(loadAccount(addressNetwork))
        // Force a refresh of the account balance to populate the store.
        this.chainService.getLatestBaseAccountBalance(addressNetwork)
      })
    })

    this.chainService.emitter.on(
      "initializeActivitiesForAccount",
      async (payloadForAccount) => {
        this.store.dispatch(initializeActivitiesForAccount(payloadForAccount))
        await this.enrichActivitiesForSelectedAccount()
      }
    )

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

    this.blockService.emitter.on("block", (block) => {
      this.store.dispatch(blockSeen(block))
    })

    this.chainService.emitter.on("transactionSend", () => {
      this.store.dispatch(
        setSnackbarConfig({ message: "Transaction signed, broadcasting..." })
      )
      this.store.dispatch(
        clearTransactionState(TransactionConstructionStatus.Idle)
      )
    })

    this.chainService.emitter.on("transactionSendFailure", () => {
      this.store.dispatch(
        setSnackbarConfig({ message: "Transaction failed to broadcast." })
      )
    })

    transactionConstructionSliceEmitter.on(
      "updateTransaction",
      async (transaction) => {
        this.store.dispatch(
          transactionRequest({
            transactionRequest: transaction,
            transactionLikelyFails: true,
          })
        )
      }
    )

    transactionConstructionSliceEmitter.on(
      "broadcastSignedTransaction",
      async (transaction: QuaiTransaction) => {
        await this.chainService.broadcastSignedTransaction(transaction)
      }
    )

    transactionConstructionSliceEmitter.on(
      "requestSignature",
      async ({ request, accountSigner }) => {
        try {
          const signedTransaction = await this.signingService.signTransaction(
            request,
            accountSigner
          )

          this.store.dispatch(transactionSigned(signedTransaction))

          await this.analyticsService.sendAnalyticsEvent(
            AnalyticsEvent.TRANSACTION_SIGNED,
            {
              chainId: signedTransaction.chainId,
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
          const signedData = await this.signingService.signTypedData(
            typedData,
            account,
            accountSigner
          )
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

    this.blockService.emitter.on(
      "blockPrices",
      async ({ blockPrices, network }) => {
        this.store.dispatch(
          estimatedFeesPerGas({ estimatedFeesPerGas: blockPrices, network })
        )
      }
    )

    uiSliceEmitter.on("userActivityEncountered", (addressOnNetwork) => {
      this.chainService.markAccountActivity(addressOnNetwork)
    })
  }

  async connectProviderFactoryService(): Promise<void> {
    this.providerFactoryService.emitter.on(
      "localNodeNetworkStatus",
      async (localNodeNetworkStatus: LocalNodeNetworkStatusEventTypes) => {
        this.store.dispatch(updateNetwork(localNodeNetworkStatus))
        const { isDisabled, localNodeNetworkChainId } = localNodeNetworkStatus

        const { network } = await this.preferenceService.getSelectedAccount()

        if (isDisabled && network.chainID === localNodeNetworkChainId) {
          uiSliceEmitter.emit("newSelectedNetwork", DEFAULT_PELAGUS_NETWORK)
          this.store.dispatch(setSelectedNetwork(DEFAULT_PELAGUS_NETWORK))
        }
      }
    )
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
              tracked.contractAddress ===
                balance.assetAmount.asset.contractAddress
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

  async connectKeyringService(): Promise<void> {
    this.keyringService.emitter.on("keyrings", (keyrings) => {
      this.store.dispatch(updateKeyrings(keyrings))
    })

    this.keyringService.emitter.on("address", (address) => {
      NetworksArray.forEach((network) => {
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

      this.signingService.addTrackedAddress(address, "keyring")
    })

    this.keyringService.emitter.on("locked", async (isLocked) => {
      if (isLocked) {
        this.store.dispatch(keyringLocked())
      } else {
        this.store.dispatch(keyringUnlocked())
      }
    })

    keyringSliceEmitter.on("createPassword", async (password) => {
      await this.keyringService.unlock(password)
    })

    keyringSliceEmitter.on("lockKeyrings", async () => {
      await this.keyringService.lock()
    })

    keyringSliceEmitter.on("deriveAddress", (keyringData) => {
      this.signingService.deriveAddress({
        type: "keyring",
        keyringID: keyringData.signerId,
        zone: keyringData.zone,
      })
    })

    keyringSliceEmitter.on("generateQuaiHDWalletMnemonic", async () => {
      // TODO move unlocking to a reasonable place in the initialization flow
      const generated: {
        id: string
        mnemonic: string[]
      } = await this.keyringService.generateMnemonic()

      this.store.dispatch(setKeyringToVerify(generated))
    })
  }

  async connectInternalQuaiProviderService(): Promise<void> {
    this.internalQuaiProviderService.emitter.on(
      "transactionSignatureRequest",
      async ({ payload, resolver, rejecter }) => {
        this.store.dispatch(
          clearTransactionState(TransactionConstructionStatus.Pending)
        )
        this.store.dispatch(updateTransactionData(payload))

        const clear = () => {
          this.signingService.emitter.off(
            "signTransactionResponse",
            // Mutual dependency to handleAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            handleAndClear
          )

          transactionConstructionSliceEmitter.off(
            "signatureRejected",
            // Mutual dependency to rejectAndClear.
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            rejectAndClear
          )
        }

        const handleAndClear = (response: SignTransactionResponse) => {
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

        this.signingService.emitter.on(
          "signTransactionResponse",
          handleAndClear
        )

        transactionConstructionSliceEmitter.on(
          "signatureRejected",
          rejectAndClear
        )
      }
    )
    this.internalQuaiProviderService.emitter.on(
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
        const [enrichedSignTypedDataRequest] = await Promise.all([
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
    this.internalQuaiProviderService.emitter.on(
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
        await this.blockService.pollBlockPricesForNetwork(
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
    this.internalQuaiProviderService.emitter.on(
      "selectedNetwork",
      (network) => {
        this.store.dispatch(setSelectedNetwork(network))
      }
    )

    uiSliceEmitter.on("newSelectedNetwork", (network) => {
      this.internalQuaiProviderService.routeSafeRPCRequest(
        "wallet_switchEthereumChain",
        [{ chainId: network.chainID }],
        PELAGUS_INTERNAL_ORIGIN
      )
      this.blockService.pollBlockPricesForNetwork(network.chainID)
      this.chainService.switchNetwork(network)
      this.store.dispatch(clearCustomGas())
    })

    this.internalQuaiProviderService.emitter.on(
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
      (isDefaultWallet: boolean) => {
        this.store.dispatch(setDefaultWallet(isDefaultWallet))
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
      "showAlphaWalletBanner",
      async (isHiddenAlphaWalletBanner: boolean) => {
        this.store.dispatch(setShowAlphaWalletBanner(isHiddenAlphaWalletBanner))
      }
    )

    this.preferenceService.emitter.on(
      "showTestNetworks",
      async (isShowTestNetworks: boolean) => {
        this.store.dispatch(toggleTestNetworks(isShowTestNetworks))

        if (isShowTestNetworks) {
          this.providerFactoryService.startLocalNodeCheckingInterval()
        } else {
          this.providerFactoryService.stopLocalNodeCheckingInterval()
        }
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

    uiSliceEmitter.on(
      "showAlphaWalletBanner",
      async (isHiddenAlphaWalletBanner: boolean) => {
        await this.preferenceService.setShowAlphaWalletBanner(
          isHiddenAlphaWalletBanner
        )
      }
    )

    uiSliceEmitter.on(
      "showTestNetworks",
      async (isShowTestNetworks: boolean) => {
        await this.preferenceService.setShowTestNetworks(isShowTestNetworks)
      }
    )

    uiSliceEmitter.on("newSelectedAccount", async (addressNetwork) => {
      await this.preferenceService.setSelectedAccount(addressNetwork)

      await this.chainService.markAccountActivity(addressNetwork)

      this.providerBridgeService.notifyContentScriptsAboutAddressChange(
        addressNetwork.address
      )
    })

    uiSliceEmitter.on("newSelectedAccountSwitched", async () =>
      this.enrichActivities()
    )

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

    uiSliceEmitter.on(
      "newPelagusNotificationsValue",
      async (newShowPelagusNotificationsValue) => {
        await this.preferenceService.setShowPelagusNotificationsValue(
          newShowPelagusNotificationsValue
        )

        this.analyticsService.sendAnalyticsEvent(
          AnalyticsEvent.PELAGUS_NOTIFICATIONS_TOGGLED,
          {
            setPelagusNotifications: newShowPelagusNotificationsValue,
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
    return this.keyringService.exportWalletPrivateKey(address)
  }

  async importSigner(
    signerRaw: SignerImportMetadata
  ): Promise<{ address: string | null; errorMessage: string }> {
    return this.keyringService.importKeyring(signerRaw)
  }

  async getActivityDetails(txHash: string): Promise<ActivityDetail[]> {
    const transaction = await this.chainService.getTransaction(txHash)
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

    this.chainService.emitter.on(
      "networkSubscribed",
      (network: NetworkInterface) => {
        this.analyticsService.sendOneTimeAnalyticsEvent(
          OneTimeAnalyticsEvent.CHAIN_ADDED,
          {
            chainId: network.chainID,
            name: network.baseAsset.name,
            description: `This event is fired when a chain is subscribed to from the wallet for the first time.`,
          }
        )
      }
    )

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

  async queryCustomTokenDetails(
    contractAddress: string,
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
          sameQuaiAddress(contractAddress, asset.contractAddress)
      )

    const assetData = await this.chainService.queryAccountTokenDetails(
      contractAddress,
      addressOnNetwork,
      cachedAsset
    )

    return {
      ...assetData,
      balance: Number.parseFloat(
        formatUnits(assetData.amount, assetData.asset.decimals)
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

      logger.info("Pelagus Connected")
      walletOpen = true
      this.manuallyCheckBalances()

      const openTime = Date.now()

      const originalNetworkName =
        this.store.getState().ui.selectedAccount.network.baseAsset.name

      port.onDisconnect.addListener(() => {
        const networkNameAtClose =
          this.store.getState().ui.selectedAccount.network.baseAsset.name
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
        this.store.dispatch(resetSnackbarConfig())
        logger.info("Pelagus Disconnected")
        this.onPopupDisconnected()
      })
    })
  }

  private onPopupDisconnected() {
    this.store.dispatch(rejectTransactionSignature())
    this.store.dispatch(rejectDataSignature())
  }
}
