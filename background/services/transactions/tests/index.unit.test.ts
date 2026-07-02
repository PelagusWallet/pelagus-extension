import TransactionService from ".."

jest.mock("../../notifications", () => ({
  __esModule: true,
  default: {
    createFailedQiTxNotification: jest.fn(),
    createSendQiTxNotification: jest.fn(),
  },
}))

const getQiReceiveAddresses = (input: {
  count?: unknown
  zone?: unknown
  account?: unknown
}) =>
  TransactionService.prototype.getQiReceiveAddresses.call({}, input) as Promise<
    string[]
  >

const normalizeQiSendToOutputsRequest = (input: unknown) =>
  TransactionService.prototype.normalizeQiSendToOutputsRequest.call(
    {},
    input as Parameters<
      TransactionService["normalizeQiSendToOutputsRequest"]
    >[0]
  )

const qiAddress = "0x0080000000000000000000000000000000000000"

describe("TransactionService", () => {
  describe("getQiReceiveAddresses", () => {
    it.each([true, [], " ", "0x10"])(
      "rejects coerced count value %p",
      async (count) => {
        await expect(getQiReceiveAddresses({ count })).rejects.toThrow(
          "count must be an integer between 1 and 32"
        )
      }
    )

    it("rejects oversized address batches", async () => {
      await expect(getQiReceiveAddresses({ count: 33 })).rejects.toThrow(
        "count must be an integer between 1 and 32"
      )
    })

    it("rejects nonzero account indexes", async () => {
      await expect(getQiReceiveAddresses({ account: 1 })).rejects.toThrow(
        "account must be 0"
      )
    })
  })

  describe("normalizeQiSendToOutputsRequest", () => {
    it("rejects unsafe JS number qit amounts", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          zone: "0x00",
          outputs: [
            {
              address: qiAddress,
              amountQit: Number.MAX_SAFE_INTEGER + 1,
            },
          ],
        })
      ).toThrow("outputs[0].amountQit must be an integer qit amount")
    })

    it("rejects oversized account strings before Number conversion", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          zone: "0x00",
          account: "9007199254740993",
          outputs: [
            {
              address: qiAddress,
              denomination: 0,
            },
          ],
        })
      ).toThrow("account must be a non-negative integer")
    })
  })
})
