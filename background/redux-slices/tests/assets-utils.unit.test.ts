import {
  enrichAssetAmountWithMainCurrencyValues,
  formatCurrencyAmount,
  sameNetworkBaseAsset,
} from "../utils/asset-utils"
import { createAssetAmount, createPricePoint } from "../../tests/factories"
import { QUAI } from "../../constants"

describe(sameNetworkBaseAsset, () => {
  test("should handle built in network base assets", () => {
    expect(sameNetworkBaseAsset(QUAI, QUAI)).toBe(true)
  })
})

describe(formatCurrencyAmount, () => {
  test("should return the localized currency amount without the symbol", () => {
    expect(formatCurrencyAmount("USD", 100, 2)).toBe("100.00")
  })
})

describe(enrichAssetAmountWithMainCurrencyValues, () => {
  test("should add localized price and currency data to an asset amount ", () => {
    const assetAmount = createAssetAmount()
    const pricePoint = createPricePoint(assetAmount.asset, 1637.7)

    const result = enrichAssetAmountWithMainCurrencyValues(
      assetAmount,
      pricePoint,
      2
    )

    expect(result).toMatchObject({
      ...assetAmount,
      localizedMainCurrencyAmount: "1,637.70",
      localizedUnitPrice: "1,637.70",
      mainCurrencyAmount: 1637.7,
      unitPrice: 1637.7,
    })
  })
})
