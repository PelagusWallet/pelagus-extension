import { USD } from "../../constants"
import { Preferences } from "./types"
import { QuaiMainnet } from "../../constants/networks/networks"

const defaultPreferences: Preferences = {
  tokenLists: {
    autoUpdate: false,
    urls: [],
  },
  currency: USD,
  defaultWallet: false,
  selectedAccount: {
    address: "",
    network: QuaiMainnet,
  },
  accountSignersSettings: [],
  analytics: {
    isEnabled: false,
    hasDefaultOnBeenTurnedOn: false,
  },
  showDefaultWalletBanner: true,
  showAlphaWalletBanner: true,
  alphaBannerVersion: 1,
  showTestNetworks: false,
  showPelagusNotifications: true,
  showPaymentChannelModal: true,
  theme: "dark",
}

export default defaultPreferences
