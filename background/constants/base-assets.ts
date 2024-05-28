import { NetworkBaseAsset } from "../networks"
import { coinTypesByAssetSymbol } from "./coin-types"

export const QUAI: NetworkBaseAsset = {
  chainID: "9000",
  name: "Quai Network",
  symbol: "QUAI",
  decimals: 18,
  coinType: coinTypesByAssetSymbol.QUAI,
  metadata: {
    tokenLists: [],
    websiteURL: "https://qu.ai/",
  },
}
export const QUAI_LOCAL: NetworkBaseAsset = {
  chainID: "1337",
  name: "Quai Network Local",
  symbol: "QUAI",
  decimals: 18,
  coinType: coinTypesByAssetSymbol.QUAI,
  metadata: {
    tokenLists: [],
    websiteURL: "https://qu.ai/",
  },
}

export const BASE_ASSETS_BY_CUSTOM_NAME = {
  QUAI,
  QUAI_LOCAL,
}
export const BASE_ASSETS = Object.values(BASE_ASSETS_BY_CUSTOM_NAME)
