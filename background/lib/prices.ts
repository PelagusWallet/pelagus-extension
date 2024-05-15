import {
  FungibleAsset,
  PricePoint,
  SmartContractFungibleAsset,
  UnitPricePoint,
} from "../assets"

import { USD } from "../constants"

/*
 * Get a Price Point for asset to USD.
 */
export function getPricePoint(
  asset: SmartContractFungibleAsset | FungibleAsset,
  unitPricePoint: UnitPricePoint<FungibleAsset>
): PricePoint {
  return {
    pair: [asset, USD],
    amounts: [
      1n * 10n ** BigInt(asset.decimals),
      BigInt(
        Math.trunc(
          (Number(unitPricePoint.unitPrice.amount) /
            10 ** (unitPricePoint.unitPrice.asset as FungibleAsset).decimals) *
            10 ** USD.decimals
        )
      ),
    ],
    time: unitPricePoint.time,
  }
}
