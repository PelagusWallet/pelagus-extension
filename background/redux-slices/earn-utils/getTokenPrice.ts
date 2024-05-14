import { BigNumber } from "ethers"
import { AssetsState, selectAssetPricePoint } from "../assets"
import { HexString } from "../../types"
import { AnyAsset, PricePoint } from "../../assets"

const getTokenPrice = async (
  asset: AnyAsset & { decimals: number; contractAddress: HexString },
  assets: AssetsState
): Promise<{ singleTokenPrice: bigint; pricePoint: PricePoint }> => {
  const mainCurrencySymbol = "USD"
  let tokenPrice
  const assetPricePoint = selectAssetPricePoint(
    assets,
    asset,
    mainCurrencySymbol
  )
  tokenPrice = assetPricePoint?.amounts[1]

  if (typeof tokenPrice === "undefined") {
    tokenPrice = 0n
  }

  const bigIntDecimals = BigNumber.from("10")
    .pow(BigNumber.from(asset.decimals))
    .toBigInt()
  const USDAsset = {
    name: "United States Dollar",
    symbol: "USD",
    decimals: 10,
  }
  const imitatedPricePoint = {
    pair: [asset, USDAsset],
    amounts: [bigIntDecimals, tokenPrice],
    time: Date.now(),
  } as PricePoint

  return { singleTokenPrice: tokenPrice, pricePoint: imitatedPricePoint }
}

export default getTokenPrice
