import { FiatCurrency } from "../../assets"
import { AddressOnNetwork, AccountSignerSettings } from "../../accounts"

export interface TokenListPreferences {
  autoUpdate: boolean
  urls: string[]
}

export interface Preferences {
  tokenLists: TokenListPreferences
  currency: FiatCurrency
  defaultWallet: boolean
  selectedAccount: AddressOnNetwork
  accountSignersSettings: AccountSignerSettings[]
  analytics: {
    isEnabled: boolean
    hasDefaultOnBeenTurnedOn: boolean
  }
  showDefaultWalletBanner: boolean
}

export type AnalyticsPreferences = Preferences["analytics"]
