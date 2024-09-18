import { NetworkBaseAsset } from "../networks"
import { COIN_TYPES_BY_ASSET_SYMBOL } from "./coin-types"

export const QUAI: NetworkBaseAsset = {
  chainID: "9000",
  name: "Quai Network",
  symbol: "QUAI",
  decimals: 18,
  coinType: COIN_TYPES_BY_ASSET_SYMBOL.QUAI,
  metadata: {
    tokenLists: [],
    websiteURL: "https://qu.ai/",
  },
}
export const QUAI_LOCAL: NetworkBaseAsset = {
  chainID: "17000",
  name: "Quai Network Local",
  symbol: "QUAI",
  decimals: 18,
  coinType: COIN_TYPES_BY_ASSET_SYMBOL.QUAI,
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
