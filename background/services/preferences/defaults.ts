import { USD } from "../../constants"
import { Preferences } from "./types"
import { QuaiGoldenAgeTestnet } from "../../constants/networks/networks"

const defaultPreferences: Preferences = {
  tokenLists: {
    autoUpdate: false,
    urls: [],
  },
  currency: USD,
  defaultWallet: false,
  selectedAccount: {
    address: "",
    network: QuaiGoldenAgeTestnet,
  },
  accountSignersSettings: [],
  analytics: {
    isEnabled: true,
    hasDefaultOnBeenTurnedOn: true,
  },
  showDefaultWalletBanner: true,
  showTestNetworks: false,
}

export default defaultPreferences
