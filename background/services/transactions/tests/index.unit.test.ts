import TransactionService from ".."

const getQiReceiveAddresses = (input: {
  count?: unknown
  zone?: unknown
  account?: unknown
}) =>
  TransactionService.prototype.getQiReceiveAddresses.call({}, input) as Promise<
    string[]
  >

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
})
