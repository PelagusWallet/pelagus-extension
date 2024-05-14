import { SwappableAsset } from "../../assets"
import { EVMNetwork } from "../../networks"
import { AssetsState } from "../assets"

type SwapAssets = {
  sellAsset: SwappableAsset
  buyAsset: SwappableAsset
}

type SwapAmount =
  | {
      sellAmount: string
    }
  | {
      buyAmount: string
    }

export type SwapQuoteRequest = {
  assets: SwapAssets
  amount: SwapAmount
  slippageTolerance: number
  gasPrice: bigint
  network: EVMNetwork
}

export type PriceDetails = {
  priceImpact?: number
  buyCurrencyAmount?: string
  sellCurrencyAmount?: string
}

// REFACTOR remove function
/**
 * If the tokenToEthRate of a is less than 0.1
 * we will probably not get information about the price of the asset.
 */
export async function checkCurrencyAmount(
  tokenToEthRate: number,
  asset: SwappableAsset,
  assets: AssetsState,
  amount: string,
  network: EVMNetwork
): Promise<string | undefined> {
  return undefined
}
