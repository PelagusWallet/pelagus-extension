import { FiatCurrency } from "../assets"
import { NetworkBaseAsset } from "../networks"
import { BASE_ASSETS_BY_CUSTOM_NAME } from "./base-assets"
import { coinTypesByAssetSymbol } from "./coin-types"

export const USD: FiatCurrency = {
  name: "United States Dollar",
  symbol: "USD",
  decimals: 10,
}

export const FIAT_CURRENCIES = [USD]
export const FIAT_CURRENCIES_SYMBOL = FIAT_CURRENCIES.map(
  (currency) => currency.symbol
)

export const QUAI: NetworkBaseAsset = {
  ...BASE_ASSETS_BY_CUSTOM_NAME.QUAI,
  coinType: coinTypesByAssetSymbol.QUAI,
  metadata: {
    tokenLists: [],
    websiteURL: "https://qu.ai/",
  },
}

export const QUAI_LOCAL: NetworkBaseAsset = {
  ...BASE_ASSETS_BY_CUSTOM_NAME.QUAI_LOCAL,
  coinType: coinTypesByAssetSymbol.QUAI,
  metadata: {
    tokenLists: [],
    websiteURL: "https://qu.ai/",
  },
}

export const BUILT_IN_NETWORK_BASE_ASSETS = [QUAI]
