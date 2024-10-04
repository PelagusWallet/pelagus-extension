import { ReactElement } from "react"
import Wallet from "../pages/Wallet"
import SignTransaction from "../pages/SignTransaction"
import SignData from "../pages/SignData"
import PersonalSign from "../pages/PersonalSign"
import SingleAsset from "../pages/SingleAsset"
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
import SettingsAddCustomAsset from "../pages/Settings/SettingsAddCustomAsset"
import SendPage from "../pages/_NewDesign/SendPage"
import ConfirmTransactionPage from "../pages/_NewDesign/ConfirmTransactionPage"

type PageList = {
  path: string
  // Tricky to handle all props components are
  // accepting here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: (...args: any[]) => ReactElement
  hasTopBar: boolean
}

const pageList: PageList[] = [
  {
    path: "/keyring/set-password",
    Component: KeyringSetPassword,
    hasTopBar: false,
  },
  {
    path: "/keyring/unlock",
    Component: KeyringUnlock,
    hasTopBar: false,
  },
  {
    path: "/singleAsset",
    Component: SingleAsset,
    hasTopBar: true,
  },
  {
    path: "/sign-transaction",
    Component: SignTransaction,
    hasTopBar: false,
  },
  {
    path: "/sign-data",
    Component: SignData,
    hasTopBar: false,
  },
  {
    path: "/personal-sign",
    Component: PersonalSign,
    hasTopBar: false,
  },
  {
    path: "/settings/export-logs",
    Component: SettingsExportLogs,
    hasTopBar: false,
  },
  {
    path: "/settings/connected-websites",
    Component: SettingsConnectedWebsites,
    hasTopBar: false,
  },
  {
    path: "/settings/analytics",
    Component: SettingsAnalytics,
    hasTopBar: false,
  },
  {
    path: "/settings/add-custom-asset",
    Component: SettingsAddCustomAsset,
    hasTopBar: false,
  },
  {
    path: "/settings",
    Component: Menu,
    hasTopBar: false,
  },
  {
    path: "/send/qi/confirmation",
    Component: ConfirmTransactionPage,
    hasTopBar: false,
  },
  {
    path: "/send/qi",
    Component: SendPage,
    hasTopBar: false,
  },
  {
    path: "/send",
    Component: Send,
    hasTopBar: true,
  },
  {
    path: "/dapp-permission",
    Component: DAppPermissionRequest,
    hasTopBar: false,
  },
  {
    path: "/dev/feature-flags",
    Component: FeatureFlagsPanel,
    hasTopBar: false,
  },
  {
    path: "/dev",
    Component: HiddenDevPanel,
    hasTopBar: false,
  },
  {
    path: "/",
    Component: Wallet,
    hasTopBar: true,
  },
]

export default pageList
