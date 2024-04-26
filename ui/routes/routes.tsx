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
import Swap from "../pages/Swap"
import DAppPermissionRequest from "../pages/DAppConnectRequest"
import KeyringUnlock from "../components/Keyring/KeyringUnlock"
import KeyringSetPassword from "../components/Keyring/KeyringSetPassword"
import Eligible from "../pages/Claiming/Eligible"
import SettingsExportLogs from "../pages/Settings/SettingsExportLogs"
import SettingsAnalytics from "../pages/Settings/SettingsAnalytics"
import SettingsConnectedWebsites from "../pages/Settings/SettingsConnectedWebsites"
import HiddenDevPanel from "../components/HiddenDevPanel/HiddenDevPanel"
import FeatureFlagsPanel from "../components/HiddenDevPanel/FeatureFlagsPanel"
import Abilities from "../pages/Abilities"
import SettingsCustomNetworks from "../pages/Settings/SettingsCustomNetworks"
import NewCustomNetworkRequest from "../pages/NewCustomNetworkRequest"
import SettingsAddCustomAsset from "../pages/Settings/SettingsAddCustomAsset"

type PageList = {
  path: string
  // Tricky to handle all props components are
  // accepting here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: (...args: any[]) => ReactElement
  hasTabBar: boolean
  hasTopBar: boolean
  persistOnClose: boolean
}

const pageList: PageList[] = [
  {
    path: "/keyring/set-password",
    Component: KeyringSetPassword,
    hasTabBar: false,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/keyring/unlock",
    Component: KeyringUnlock,
    hasTabBar: false,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/singleAsset",
    Component: SingleAsset,
    hasTabBar: true,
    hasTopBar: true,
    persistOnClose: true,
  },
  {
    path: "/sign-transaction",
    Component: SignTransaction,
    hasTabBar: false,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/add-evm-chain",
    Component: NewCustomNetworkRequest,
    hasTabBar: false,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/sign-data",
    Component: SignData,
    hasTabBar: false,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/personal-sign",
    Component: PersonalSign,
    hasTabBar: false,
    hasTopBar: false,
    persistOnClose: true,
  },

  // Will likely be added back to the tab nav in the future.
  // {
  //   path: "/portfolio",
  //   Component: Overview,
  //   hasTabBar: true,
  //   hasTopBar: false,
  //   persistOnClose: true,
  // },

  {
    path: "/earn/deposit",
    Component: EarnDeposit,
    hasTabBar: true,
    hasTopBar: true,
    persistOnClose: true,
  },
  {
    path: "/earn",
    Component: Earn,
    hasTabBar: true,
    hasTopBar: true,
    persistOnClose: true,
  },
  {
    path: "/settings/export-logs",
    Component: SettingsExportLogs,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings/connected-websites",
    Component: SettingsConnectedWebsites,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings/analytics",
    Component: SettingsAnalytics,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings/custom-networks",
    Component: SettingsCustomNetworks,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings/add-custom-asset",
    Component: SettingsAddCustomAsset,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/settings",
    Component: Menu,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/abilities",
    Component: Abilities,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/send",
    Component: Send,
    hasTabBar: true,
    hasTopBar: true,
    persistOnClose: true,
  },

  // Will likely be added back to available routes in the future.
  // removing it so that the user does not accidentally go to this screen even with the disabled buttons
  // {
  //   path: "/swap",
  //   Component: Swap,
  //   hasTabBar: true,
  //   hasTopBar: true,
  //   persistOnClose: true,
  // },

  // Will likely be added back to the tab nav in the future.
  // {
  //   path: "/nfts",
  //   Component: NFTs,
  //   hasTabBar: true,
  //   hasTopBar: false,
  //   persistOnClose: true,
  // },

  {
    path: "/dapp-permission",
    Component: DAppPermissionRequest,
    hasTabBar: false,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/eligible",
    Component: Eligible,
    hasTabBar: false,
    hasTopBar: false,
    persistOnClose: true,
  },
  {
    path: "/dev/feature-flags",
    Component: FeatureFlagsPanel,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/dev",
    Component: HiddenDevPanel,
    hasTabBar: true,
    hasTopBar: false,
    persistOnClose: false,
  },
  {
    path: "/",
    Component: Wallet,
    hasTabBar: true,
    hasTopBar: true,
    persistOnClose: true,
  },
]

export default pageList
