import { createSelector, createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { AnalyticsEvent, OneTimeAnalyticsEvent } from "../lib/posthog"
import { ChainIdWithError } from "../networks"
import { AnalyticsPreferences } from "../services/preferences/types"
import {
  AccountSignerSettings,
  AccountSignerWithId,
  AddressOnNetwork,
} from "../accounts"
import { AccountState, addAddressNetwork } from "./accounts"
import { createBackgroundAsyncThunk, SnackBarType } from "./utils"
import { getExtendedZoneForAddress } from "../services/chain/utils"
import { NetworkInterface } from "../constants/networks/networkTypes"
import { QuaiGoldenAgeTestnet } from "../constants/networks/networks"

export const defaultSettings = {
  hideDust: false,
  defaultWallet: false,
  networkConnectError: [],
  showTestNetworks: false,
  showPaymentChannelModal: true,
  collectAnalytics: false,
  showAnalyticsNotification: false,
  showUnverifiedAssets: false,
  hideBanners: false,
  showDefaultWalletBanner: true,
  showAlphaWalletBanner: true,
  showPelagusNotifications: true,
}

const defaultSnackbarDuration = 2500

export type UIState = {
  selectedAccount: AddressOnNetwork
  showingActivityDetailID: string | null
  showingAccountsModal: boolean
  showingAddAccountModal: boolean
  initializationLoadingTimeExpired: boolean
  // FIXME: Move these settings to preferences service db
  settings: {
    hideDust: boolean
    defaultWallet: boolean
    showPelagusNotifications: boolean
    networkConnectError: ChainIdWithError[]
    showTestNetworks: boolean
    showPaymentChannelModal: boolean
    collectAnalytics: boolean
    showAnalyticsNotification: boolean
    showUnverifiedAssets: boolean
    hideBanners: boolean
    showDefaultWalletBanner: boolean
    showAlphaWalletBanner: boolean
  }
  snackbarConfig: {
    message: string
    withSound: boolean
    type: SnackBarType
    duration: number
  }
  slippageTolerance: number
  accountSignerSettings: AccountSignerSettings[]
}

export type Events = {
  snackbarConfig: {
    message: string
    withSound?: boolean
    type: SnackBarType
    duration?: number
  }
  deleteAnalyticsData: never
  newDefaultWalletValue: boolean
  newPelagusNotificationsValue: boolean
  newNetworkConnectError: ChainIdWithError[]
  refreshBackgroundPage: null
  sendEvent: AnalyticsEvent | OneTimeAnalyticsEvent
  newSelectedAccount: AddressOnNetwork
  newSelectedAccountSwitched: never
  newSelectedNetwork: NetworkInterface
  updateAnalyticsPreferences: Partial<AnalyticsPreferences>
  addCustomNetworkResponse: [string, boolean]
  showDefaultWalletBanner: boolean
  showAlphaWalletBanner: boolean
  showTestNetworks: boolean
  showPaymentChannelModal: boolean
}

export const emitter = new Emittery<Events>()

export const initialState: UIState = {
  showingActivityDetailID: null,
  showingAccountsModal: false,
  showingAddAccountModal: false,
  selectedAccount: {
    address: "",
    network: QuaiGoldenAgeTestnet,
  },
  initializationLoadingTimeExpired: false,
  settings: defaultSettings,
  snackbarConfig: {
    message: "",
    withSound: false,
    type: SnackBarType.base,
    duration: defaultSnackbarDuration,
  },
  slippageTolerance: 0.01,
  accountSignerSettings: [],
}

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleHideDust: (
      immerState,
      { payload: shouldHideDust }: { payload: boolean }
    ): void => {
      immerState.settings.hideDust = shouldHideDust
    },
    toggleTestNetworks: (
      immerState,
      { payload: showTestNetworks }: { payload: boolean }
    ): void => {
      immerState.settings.showTestNetworks = showTestNetworks
    },
    setShowPaymentChannelModal: (
      immerState,
      { payload: isShowPaymentChannelModal }: { payload: boolean }
    ): void => {
      immerState.settings.showPaymentChannelModal = isShowPaymentChannelModal
    },
    toggleShowUnverifiedAssets: (
      immerState,
      { payload: showUnverifiedAssets }: { payload: boolean }
    ): void => {
      immerState.settings.showUnverifiedAssets = showUnverifiedAssets
    },
    toggleCollectAnalytics: (
      state,
      { payload: collectAnalytics }: { payload: boolean }
    ) => ({
      ...state,
      settings: {
        ...state.settings,
        collectAnalytics,
        showAnalyticsNotification: false,
      },
    }),
    setShowAnalyticsNotification: (
      state,
      { payload: showAnalyticsNotification }: { payload: boolean }
    ) => ({
      ...state,
      settings: {
        ...state.settings,
        showAnalyticsNotification,
      },
    }),
    toggleHideBanners: (
      state,
      { payload: hideBanners }: { payload: boolean }
    ) => ({
      ...state,
      settings: {
        ...state.settings,
        hideBanners,
      },
    }),
    setShowingActivityDetail: (
      state,
      { payload: transactionID }: { payload: string | null }
    ): UIState => ({
      ...state,
      showingActivityDetailID: transactionID,
    }),
    setShowingAccountsModal: (
      state,
      { payload: isShowingAccountsModal }: { payload: boolean }
    ): UIState => ({
      ...state,
      showingAccountsModal: isShowingAccountsModal,
    }),
    setShowingAddAccountModal: (
      state,
      { payload: isShowingAddAccountModal }: { payload: boolean }
    ): UIState => ({
      ...state,
      showingAddAccountModal: isShowingAddAccountModal,
    }),
    setSelectedAccount: (
      immerState,
      { payload: addressNetwork }: { payload: AddressOnNetwork }
    ) => {
      const shard = getExtendedZoneForAddress(addressNetwork.address)
      globalThis.main.SetShard(shard)
      // TODO: Potentially call getLatestBaseAccountBalance here
      immerState.selectedAccount = addressNetwork
    },
    initializationLoadingTimeHitLimit: (state) => ({
      ...state,
      initializationLoadingTimeExpired: true,
    }),
    setSnackbarConfig: (
      state,
      {
        payload: { message, withSound, type, duration },
      }: {
        payload: {
          message: string
          withSound?: boolean
          type?: SnackBarType
          duration?: number
        }
      }
    ): UIState => ({
      ...state,
      snackbarConfig: {
        message,
        withSound: withSound ?? false,
        type: type ?? SnackBarType.base,
        duration: duration ?? defaultSnackbarDuration,
      },
    }),
    resetSnackbarConfig: (state): UIState => ({
      ...state,
      snackbarConfig: {
        message: "",
        withSound: false,
        type: SnackBarType.base,
        duration: defaultSnackbarDuration,
      },
    }),
    setDefaultWallet: (
      state,
      { payload: defaultWallet }: { payload: boolean }
    ) => ({
      ...state,
      settings: {
        ...state.settings,
        defaultWallet,
      },
    }),
    setShowPelagusNotifications: (
      state,
      { payload: pelagusNotifications }: { payload: boolean }
    ) => ({
      ...state,
      settings: {
        ...state.settings,
        showPelagusNotifications: pelagusNotifications,
      },
    }),
    setNetworkConnectError: (
      state,
      { payload: networkConnectError }: { payload: ChainIdWithError[] }
    ) => ({
      ...state,
      settings: {
        ...state.settings,
        networkConnectError,
      },
    }),
    setSlippageTolerance: (
      state,
      { payload: slippageTolerance }: { payload: number }
    ) => ({
      ...state,
      slippageTolerance,
    }),
    setAccountsSignerSettings: (
      state,
      { payload }: { payload: AccountSignerSettings[] }
    ) => ({ ...state, accountSignerSettings: payload }),
    setShowDefaultWalletBanner: (state, { payload }: { payload: boolean }) => {
      return {
        ...state,
        settings: { ...state.settings, showDefaultWalletBanner: payload },
      }
    },
    setShowAlphaWalletBanner: (state, { payload }: { payload: boolean }) => {
      return {
        ...state,
        settings: { ...state.settings, showAlphaWalletBanner: payload },
      }
    },
  },
})

export const {
  setShowingActivityDetail,
  setShowingAccountsModal,
  setShowingAddAccountModal,
  initializationLoadingTimeHitLimit,
  toggleHideDust,
  toggleTestNetworks,
  setShowPaymentChannelModal,
  toggleShowUnverifiedAssets,
  toggleCollectAnalytics,
  setShowAnalyticsNotification,
  toggleHideBanners,
  setSelectedAccount,
  setSnackbarConfig,
  setDefaultWallet,
  setShowPelagusNotifications,
  setNetworkConnectError,
  resetSnackbarConfig,
  setSlippageTolerance,
  setAccountsSignerSettings,
  setShowDefaultWalletBanner,
  setShowAlphaWalletBanner,
} = uiSlice.actions

export default uiSlice.reducer

export const updateAnalyticsPreferences = createBackgroundAsyncThunk(
  "ui/updateAnalyticsPreferences",
  async (collectAnalytics: boolean) => {
    await emitter.emit("updateAnalyticsPreferences", {
      isEnabled: collectAnalytics,
    })
  }
)

export const deleteAnalyticsData = createBackgroundAsyncThunk(
  "ui/deleteAnalyticsData",
  async () => {
    await emitter.emit("deleteAnalyticsData")
  }
)

// Async thunk to bubble the setNewDefaultWalletValue action from  store to emitter.
export const setNewDefaultWalletValue = createBackgroundAsyncThunk(
  "ui/setNewDefaultWalletValue",
  async (defaultWallet: boolean, { dispatch }) => {
    await emitter.emit("newDefaultWalletValue", defaultWallet)
    dispatch(uiSlice.actions.setDefaultWallet(defaultWallet))
  }
)

export const setNewPelagusNotificationsValue = createBackgroundAsyncThunk(
  "ui/setNewPelagusNotificationsValue",
  async (pelagusNotificationsValue: boolean, { dispatch }) => {
    await emitter.emit(
      "newPelagusNotificationsValue",
      pelagusNotificationsValue
    )
    dispatch(
      uiSlice.actions.setShowPelagusNotifications(pelagusNotificationsValue)
    )
  }
)

export const setNewNetworkConnectError = createBackgroundAsyncThunk(
  "ui/setNewNetworkConnectError",
  async (networkConnectError: ChainIdWithError, { getState, dispatch }) => {
    const state = getState() as { ui: UIState }
    let current = state.ui.settings.networkConnectError
    if (!Array.isArray(current)) {
      current = []
    }
    // Check if network error already exists
    for (let i = 0; i < current.length; i++) {
      if (
        current[i].chainId == networkConnectError.chainId &&
        current[i].error != networkConnectError.error
      ) {
        const newErrors = current.map((error) => {
          if (error.chainId === networkConnectError.chainId)
            return { ...error, error: networkConnectError.error }

          return error
        })
        dispatch(uiSlice.actions.setNetworkConnectError(newErrors))
        return
      }
      if (
        current[i].chainId == networkConnectError.chainId &&
        current[i].error == networkConnectError.error
      ) {
        // don't need to do anything in this case
        return
      }
    }
    // Network error doesn't exist, create it
    const newErrors: ChainIdWithError[] = [...current, networkConnectError]
    dispatch(uiSlice.actions.setNetworkConnectError(newErrors))
  }
)

// TBD @Antonio: It would be good to have a consistent naming strategy
export const setNewSelectedAccount = createBackgroundAsyncThunk(
  "ui/setNewCurrentAddressValue",
  async (addressNetwork: AddressOnNetwork, { dispatch }) => {
    const shard = getExtendedZoneForAddress(addressNetwork.address)
    globalThis.main.SetShard(shard)
    globalThis.main.chainService.getLatestBaseAccountBalance(addressNetwork)
    await emitter.emit("newSelectedAccount", addressNetwork)
    // Once the default value has persisted, propagate to the store.
    dispatch(uiSlice.actions.setSelectedAccount(addressNetwork))
    // Do async work needed after the account is switched
    await emitter.emit("newSelectedAccountSwitched")
  }
)

export const updateSignerTitle = createBackgroundAsyncThunk(
  "ui/updateSignerTitle",
  async (
    [signer, title]: [AccountSignerWithId, string],
    { extra: { main } }
  ) => {
    return main.updateSignerTitle(signer, title)
  }
)

export const getAddNetworkRequestDetails = createBackgroundAsyncThunk(
  "ui/getAddNetworkRequestDetails",
  async (requestId: string, { extra: { main } }) => {
    return main.getAddNetworkRequestDetails(requestId)
  }
)

export const addNetworkUserResponse = createBackgroundAsyncThunk(
  "ui/handleAddNetworkConfirmation",
  async ([requestId, result]: [string, boolean]) => {
    emitter.emit("addCustomNetworkResponse", [requestId, result])
  }
)

export const setSelectedNetwork = createBackgroundAsyncThunk(
  "ui/setSelectedNetwork",
  async (network: NetworkInterface, { getState, dispatch }) => {
    const state = getState() as { ui: UIState; account: AccountState }
    const { ui, account } = state
    const currentlySelectedChainID = ui.selectedAccount.network.chainID
    emitter.emit("newSelectedNetwork", network)
    // Add any accounts on the currently selected network to the newly
    // selected network - if those accounts don't yet exist on it.
    Object.keys(account.accountsData.evm[currentlySelectedChainID]).forEach(
      (address) => {
        if (!account.accountsData.evm[network.chainID]?.[address]) {
          dispatch(addAddressNetwork({ address, network }))
        }
      }
    )
    dispatch(setNewSelectedAccount({ ...ui.selectedAccount, network }))
  }
)

export const refreshBackgroundPage = createBackgroundAsyncThunk(
  "ui/refreshBackgroundPage",
  async () => {
    await emitter.emit("refreshBackgroundPage", null)
  }
)

export const sendEvent = createBackgroundAsyncThunk(
  "ui/sendEvent",
  async (event: AnalyticsEvent | OneTimeAnalyticsEvent) => {
    await emitter.emit("sendEvent", event)
  }
)

export const updateShowDefaultWalletBanner = createBackgroundAsyncThunk(
  "ui/showDefaultWalletBanner",
  async (newValue: boolean) => {
    await emitter.emit("showDefaultWalletBanner", newValue)
  }
)

export const updateAlphaWalletBanner = createBackgroundAsyncThunk(
  "ui/showAlphaWalletBanner",
  async (newValue: boolean) => {
    await emitter.emit("showAlphaWalletBanner", newValue)
  }
)

export const updateShowTestNetworks = createBackgroundAsyncThunk(
  "ui/showTestNetworks",
  async (isShowTestNetworks: boolean) => {
    await emitter.emit("showTestNetworks", isShowTestNetworks)
  }
)

export const updateShowPaymentChannelModal = createBackgroundAsyncThunk(
  "ui/showPaymentChannelModal",
  async (isShowPaymentChannelModal: boolean) => {
    await emitter.emit("showPaymentChannelModal", isShowPaymentChannelModal)
  }
)

export const selectUI = createSelector(
  (state: { ui: UIState }): UIState => state.ui,
  (uiState) => uiState
)

export const selectSettings = createSelector(selectUI, (ui) => ui.settings)

export const selectHideDust = createSelector(
  selectSettings,
  (settings) => settings?.hideDust
)

export const selectSnackbarConfig = createSelector(selectUI, (ui) =>
  ui
    ? ui.snackbarConfig
    : {
        message: "",
        withSound: false,
        type: SnackBarType.base,
        duration: defaultSnackbarDuration,
      }
)

export const selectDefaultWallet = createSelector(
  selectSettings,
  (settings) => settings?.defaultWallet
)

export const selectShowPelagusNotifications = createSelector(
  selectSettings,
  (settings) => settings?.showPelagusNotifications
)

export const selectNetworkConnectError = createSelector(
  selectSettings,
  (settings) => settings?.networkConnectError
)

export const selectShowAnalyticsNotification = createSelector(
  selectSettings,
  (settings) => settings?.showAnalyticsNotification
)

export const selectShowingAccountsModal = createSelector(
  selectUI,
  (ui) => ui.showingAccountsModal
)

export const selectShowingAddAccountModal = createSelector(
  selectUI,
  (ui) => ui.showingAddAccountModal
)

export const selectShowTestNetworks = createSelector(
  selectSettings,
  (settings) => settings?.showTestNetworks
)

export const selectShowPaymentChannelModal = createSelector(
  selectSettings,
  (settings) => settings?.showPaymentChannelModal
)

export const selectShowUnverifiedAssets = createSelector(
  selectSettings,
  (settings) => settings?.showUnverifiedAssets
)

export const selectCollectAnalytics = createSelector(
  selectSettings,
  () => false // settings?.collectAnalytics // changed to only false
)

export const selectHideBanners = createSelector(
  selectSettings,
  (settings) => settings?.hideBanners
)
export const selectShowDefaultWalletBanner = createSelector(
  selectSettings,
  (settings) => settings.showDefaultWalletBanner
)
export const selectShowAlphaWalletBanner = createSelector(
  selectSettings,
  (settings) => settings.showAlphaWalletBanner
)
