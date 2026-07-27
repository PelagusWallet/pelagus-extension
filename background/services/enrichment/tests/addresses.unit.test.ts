import { resolveAddressAnnotation } from "../addresses"
import { NetworkInterface } from "../../../constants/networks/networkTypes"

describe("address enrichment", () => {
  it("does not fetch a live balance for a counterparty", async () => {
    const getLatestBaseAccountBalance = jest.fn()
    const getCode = jest.fn().mockResolvedValue("0x")
    const chainService = {
      jsonRpcProvider: { getCode },
      getLatestBaseAccountBalance,
    }
    const nameService = {
      lookUpName: jest.fn().mockResolvedValue(undefined),
    }
    const addressOnNetwork = {
      address: "0x0010000000000000000000000000000000000000",
      network: {
        chainID: "9",
        baseAsset: { symbol: "QUAI" },
      } as NetworkInterface,
    }
    globalThis.main = {
      GetShard: jest.fn().mockReturnValue("0x00"),
      SetShard: jest.fn(),
    } as unknown as typeof globalThis.main

    const annotation = await resolveAddressAnnotation(
      chainService as never,
      nameService as never,
      addressOnNetwork
    )

    expect(getCode).toHaveBeenCalledTimes(1)
    expect(getLatestBaseAccountBalance).not.toHaveBeenCalled()
    expect(annotation.balance).toBeUndefined()
  })
})
