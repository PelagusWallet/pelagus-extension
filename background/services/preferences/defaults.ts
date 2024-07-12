import { USD } from "../../constants"
import { Preferences } from "./types"
import { QuaiNetworkGA } from "../../constants/networks/networks"

const defaultPreferences: Preferences = {
  tokenLists: {
    autoUpdate: false,
    urls: [],
  },
  currency: USD,
  defaultWallet: false,
  selectedAccount: {
    address: "",
    network: QuaiNetworkGA,
  },
  accountSignersSettings: [],
  analytics: {
    isEnabled: false,
    hasDefaultOnBeenTurnedOn: false,
  },
  showDefaultWalletBanner: true,
}

export default defaultPreferences
