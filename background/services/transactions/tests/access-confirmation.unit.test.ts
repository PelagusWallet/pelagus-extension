import { TransactionReceipt } from "quais"

import TransactionService from ".."
import { TransactionStatus } from "../types"
import { NetworkInterface } from "../../../constants/networks/networkTypes"

jest.mock("webextension-polyfill", () => ({
  __esModule: true,
  default: {
    alarms: {
      clear: jest.fn(),
      create: jest.fn(),
      onAlarm: { addListener: jest.fn(), removeListener: jest.fn() },
    },
  },
}))
jest.mock("../../notifications", () => ({
  __esModule: true,
  default: {},
}))

type TransactionServiceExternalized = {
  handleAddressAccess: (event: {
    address: string
    blockHash: string
    network: NetworkInterface
  }) => Promise<void>
  handleQuaiTransactionReceipt: (receipt: TransactionReceipt) => Promise<void>
}

type TransactionServiceTestConstructor = new (
  ...args: unknown[]
) => TransactionServiceExternalized

describe("Quai access confirmation", () => {
  it("checks a matching pending receipt once per address and block", async () => {
    jest.useFakeTimers()

    const accessedAddress = "0x0010000000000000000000000000000000000000"
    const otherAddress = "0x0020000000000000000000000000000000000000"
    const matchingHash = `0x00${"01".repeat(31)}`
    const unrelatedHash = `0x00${"02".repeat(31)}`
    const pendingTransactions = [
      {
        hash: matchingHash,
        chainId: 9,
        from: accessedAddress,
        to: otherAddress,
        status: TransactionStatus.PENDING,
      },
      {
        hash: unrelatedHash,
        chainId: 9,
        from: otherAddress,
        to: otherAddress,
        status: TransactionStatus.PENDING,
      },
    ]
    const receipt = { hash: matchingHash } as TransactionReceipt
    const getTransactionReceipt = jest.fn().mockResolvedValue(receipt)
    const db = {
      getPendingQuaiTransactions: jest
        .fn()
        .mockResolvedValue(pendingTransactions),
      getQuaiTransactionByHash: jest
        .fn()
        .mockImplementation(async (hash: string) =>
          pendingTransactions.find((transaction) => transaction.hash === hash)
        ),
    }
    const chainService = {
      getJsonRpcProviderForNetwork: jest
        .fn()
        .mockReturnValue({ getTransactionReceipt }),
    }
    const TestTransactionService =
      TransactionService as unknown as TransactionServiceTestConstructor
    const service = new TestTransactionService(db, chainService, {}, {})
    service.handleQuaiTransactionReceipt = jest
      .fn()
      .mockResolvedValue(undefined)

    const access = {
      address: accessedAddress,
      blockHash: `0x00${"03".repeat(31)}`,
      network: { chainID: "9" } as NetworkInterface,
    }
    await service.handleAddressAccess(access)
    await service.handleAddressAccess(access)

    expect(getTransactionReceipt).toHaveBeenCalledTimes(1)
    expect(getTransactionReceipt).toHaveBeenCalledWith(matchingHash)
    expect(chainService.getJsonRpcProviderForNetwork).toHaveBeenCalledWith("9")
    expect(service.handleQuaiTransactionReceipt).toHaveBeenCalledWith(receipt)

    jest.useRealTimers()
  })
})
