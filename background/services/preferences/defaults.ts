import { QUAI_NETWORK, USD } from "../../constants"
import { Preferences } from "./types"

const defaultPreferences: Preferences = {
  tokenLists: {
    autoUpdate: false,
    urls: [],
  },
  currency: USD,
  defaultWallet: false,
  selectedAccount: {
    address: "",
    network: QUAI_NETWORK,
  },
  accountSignersSettings: [],
  analytics: {
    isEnabled: false,
    hasDefaultOnBeenTurnedOn: false,
  },
  showDefaultWalletBanner: true,
}

export default defaultPreferences
