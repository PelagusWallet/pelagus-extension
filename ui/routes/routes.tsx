import { ReactElement } from "react"
import Wallet from "../pages/Wallet"
import SignTransaction from "../pages/SignTransaction"
import SignData from "../pages/SignData"
import PersonalSign from "../pages/PersonalSign"
import SingleAsset from "../pages/SingleAsset"
import Earn from "../pages/Earn"
import EarnDeposit from "../pages/EarnDeposit"
import Menu from "../pages/Settings"
import Send from "../pages/Send"
import DAppPermissionRequest from "../pages/DAppConnectRequest"
import KeyringUnlock from "../components/Keyring/KeyringUnlock"
import KeyringSetPassword from "../components/Keyring/KeyringSetPassword"
import SettingsExportLogs from "../pages/Settings/SettingsExportLogs"
import SettingsAnalytics from "../pages/Settings/SettingsAnalytics"
import SettingsConnectedWebsites from "../pages/Settings/SettingsConnectedWebsites"
import HiddenDevPanel from "../components/HiddenDevPanel/HiddenDevPanel"
import FeatureFlagsPanel from "../components/HiddenDevPanel/FeatureFlagsPanel"
import SettingsCustomNetworks from "../pages/Settings/SettingsCustomNetworks"
import NewCustomNetworkRequest from "../pages/NewCustomNetworkRequest"
import SettingsAddCustomAsset from "../pages/Settings/SettingsAddCustomAsset"

type PageList = {
  path: string
  // Tricky to handle all props components are
  // accepting here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: (...args: any[]) => ReactElement
  hasTopBar: boolean
  persistOnClose: boolean
}

const pageList: PageList[] = [
  {
    path: "/keyring/set-password",
    Component: KeyringSetPassword,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/keyring/unlock",
    Component: KeyringUnlock,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/singleAsset",
    Component: SingleAsset,
    hasTopBar: true,
    persistOnClose: true,
  },
  {
    path: "/sign-transaction",
    Component: SignTransaction,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/add-evm-chain",
    Component: NewCustomNetworkRequest,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/sign-data",
    Component: SignData,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/personal-sign",
    Component: PersonalSign,
    hasTopBar: false,
    persistOnClose: true,
  },

  {
    path: "/earn/deposit",
    Component: EarnDeposit,
    hasTopBar: true,
    persistOnClose: true,
  },
  {
    path: "/earn",
    Component: Earn,
    hasTopBar: true,
    persistOnClose: true,
  },
  {
    path: "/settings/export-logs",
    Component: SettingsExportLogs,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings/connected-websites",
    Component: SettingsConnectedWebsites,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings/analytics",
    Component: SettingsAnalytics,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings/custom-networks",
    Component: SettingsCustomNetworks,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings/add-custom-asset",
    Component: SettingsAddCustomAsset,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings",
    Component: Menu,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/send",
    Component: Send,
    hasTopBar: true,
    persistOnClose: true,
  },
  {
    path: "/dapp-permission",
    Component: DAppPermissionRequest,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/dev/feature-flags",
    Component: FeatureFlagsPanel,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/dev",
    Component: HiddenDevPanel,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/",
    Component: Wallet,
    hasTopBar: true,
    persistOnClose: true,
  },
]

export default pageList
