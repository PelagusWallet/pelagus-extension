import reducer, {
  clearCustomGas,
  getAutomaticGasPrice,
  initialState,
  NetworkFeeTypeChosen,
} from "../transaction-construction"

jest.mock("webextension-polyfill", () => ({
  __esModule: true,
  default: {},
}))

describe("Transaction Construction Redux Slice", () => {
  describe("Actions", () => {
    describe("clearCustomGas", () => {
      it("Should reset selected fee type to Regular", () => {
        const mockState = {
          ...initialState,
          feeTypeSeected: NetworkFeeTypeChosen.Custom,
        }

        const newState = reducer(mockState, clearCustomGas())
        expect(newState.feeTypeSelected).toBe(NetworkFeeTypeChosen.Regular)
      })
    })
  })

  describe("getAutomaticGasPrice", () => {
    it("reuses the regular gas price already fetched for transaction review", () => {
      expect(
        getAutomaticGasPrice({
          regular: {
            gasPrice: 6_000_000_000n,
            confidence: 70,
          },
          baseFeePerGas: 5_000_000_000n,
        })
      ).toBe(6_000_000_000n)
    })
  })
})
