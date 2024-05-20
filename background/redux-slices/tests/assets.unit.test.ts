import {
  SmartContractFungibleAsset,
  unitPricePointForPricePoint,
} from "../../assets"
import { QUAI } from "../../constants"
import {
  createPricePoint,
  createSmartContractAsset,
} from "../../tests/factories"
import reducer, { assetsLoaded } from "../assets"

const asset: SmartContractFungibleAsset = createSmartContractAsset()

describe("Reducers", () => {
  describe("assetsLoaded", () => {
    test("updates cached asset metadata", () => {
      const state = reducer([], assetsLoaded([asset]))

      expect(state[0].metadata?.verified).not.toBeDefined()

      const newState = reducer(
        state,
        assetsLoaded([{ ...asset, metadata: { verified: true } }])
      )

      expect(newState[0].metadata?.verified).toBeTruthy()
    })
  })
})

describe(unitPricePointForPricePoint, () => {
  // An asset amount of the second asset using the pair's price point data
  test("should return the unit price of an asset using a price point", () => {
    const result = unitPricePointForPricePoint(createPricePoint(QUAI, 1500))

    expect(result).toMatchObject({
      unitPrice: {
        asset: { name: "United States Dollar", symbol: "USD", decimals: 10 },
        amount: 15000000000000n,
      },
      time: expect.any(Number),
    })
  })
})
