import { createSlice, createSelector } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { AnalyticsEvent, OneTimeAnalyticsEvent } from "../lib/posthog"
import { ChainIdWithError } from "../networks"
import { AnalyticsPreferences } from "../services/preferences/types"
import {
  AddressOnNetwork,
  AccountSignerWithId,
  AccountSignerSettings,
} from "../accounts"
import { AccountState, addAddressNetwork } from "./accounts"
import { createBackgroundAsyncThunk } from "./utils"
import { getExtendedZoneForAddress } from "../services/chain/utils"
import { NetworkInterfaceGA } from "../constants/networks/networkTypes"
import { QuaiNetworkGA } from "../constants/networks/networks"

export const defaultSettings = {
  hideDust: false,
  defaultWallet: false,
  networkConnectError: [],
  showTestNetworks: false,
  collectAnalytics: false,
  showAnalyticsNotification: false,
  showUnverifiedAssets: false,
  hideBanners: false,
  showDefaultWalletBanner: true,
  showAlphaWalletBanner: true,
}

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
    networkConnectError: ChainIdWithError[]
    showTestNetworks: boolean
    collectAnalytics: boolean
    showAnalyticsNotification: boolean
    showUnverifiedAssets: boolean
    hideBanners: boolean
    showDefaultWalletBanner: boolean
    showAlphaWalletBanner: boolean
  }
  snackbarMessage: string
  routeHistoryEntries?: Partial<Location>[]
  slippageTolerance: number
  accountSignerSettings: AccountSignerSettings[]
}

export type Events = {
  snackbarMessage: string
  deleteAnalyticsData: never
  newDefaultWalletValue: boolean
  newNetworkConnectError: ChainIdWithError[]
  refreshBackgroundPage: null
  sendEvent: AnalyticsEvent | OneTimeAnalyticsEvent
  newSelectedAccount: AddressOnNetwork
  newSelectedAccountSwitched: never
  userActivityEncountered: AddressOnNetwork
  newSelectedNetwork: NetworkInterfaceGA
  updateAnalyticsPreferences: Partial<AnalyticsPreferences>
  addCustomNetworkResponse: [string, boolean]
  showDefaultWalletBanner: boolean
  showAlphaWalletBanner: boolean
}

export const emitter = new Emittery<Events>()

export const initialState: UIState = {
  showingActivityDetailID: null,
  showingAccountsModal: false,
  showingAddAccountModal: false,
  selectedAccount: {
    address: "",
    network: QuaiNetworkGA,
  },
  initializationLoadingTimeExpired: false,
  settings: defaultSettings,
  snackbarMessage: "",
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
    setSnackbarMessage: (
      state,
      { payload: snackbarMessage }: { payload: string }
    ): UIState => ({
      ...state,
      snackbarMessage,
    }),
    clearSnackbarMessage: (state): UIState => ({
      ...state,
      snackbarMessage: "",
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
    setRouteHistoryEntries: (
      state,
      { payload: routeHistoryEntries }: { payload: Partial<Location>[] }
    ) => ({
      ...state,
      routeHistoryEntries,
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
  toggleShowUnverifiedAssets,
  toggleCollectAnalytics,
  setShowAnalyticsNotification,
  toggleHideBanners,
  setSelectedAccount,
  setSnackbarMessage,
  setDefaultWallet,
  setNetworkConnectError,
  clearSnackbarMessage,
  setRouteHistoryEntries,
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

export const userActivityEncountered = createBackgroundAsyncThunk(
  "ui/userActivityEncountered",
  async (addressNetwork: AddressOnNetwork) => {
    await emitter.emit("userActivityEncountered", addressNetwork)
  }
)

export const setSelectedNetwork = createBackgroundAsyncThunk(
  "ui/setSelectedNetwork",
  async (network: NetworkInterfaceGA, { getState, dispatch }) => {
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

export const selectUI = createSelector(
  (state: { ui: UIState }): UIState => state.ui,
  (uiState) => uiState
)

export const selectSettings = createSelector(selectUI, (ui) => ui.settings)

export const selectHideDust = createSelector(
  selectSettings,
  (settings) => settings?.hideDust
)

export const selectSnackbarMessage = createSelector(selectUI, (ui) =>
  ui ? ui.snackbarMessage : ""
)

export const selectDefaultWallet = createSelector(
  selectSettings,
  (settings) => settings?.defaultWallet
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
