import { QuaiTransactionResponse } from "quais/lib/commonjs/providers"

import TransactionService from ".."
import { SignerSourceTypes } from "../../keyring/types"

jest.mock("../../../lib/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}))
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

const TX_HASH = `0x00${"05".repeat(31)}`
const FROM_ADDRESS = "0x0000000000000000000000000000000000000001"
const TO_ADDRESS = "0x0000000000000000000000000000000000000002"

type Fault = "database" | "accounts" | "activityEvent" | "sendEvent" | "monitor"

function createService(fault?: Fault) {
  const transactionResponse = {
    to: TO_ADDRESS,
    from: FROM_ADDRESS,
    chainId: 9n,
    hash: TX_HASH,
    data: "0x",
    gasLimit: 21_000n,
    gasPrice: 1n,
    nonce: 1,
    type: 0,
    value: 1n,
    index: 0n,
  } as unknown as QuaiTransactionResponse
  const signer = {
    connect: jest.fn(),
    sendTransaction: jest.fn().mockResolvedValue(transactionResponse),
  }
  const db = {
    addOrUpdateQuaiTransaction:
      fault === "database"
        ? jest.fn().mockRejectedValue(new Error("database write failed"))
        : jest.fn().mockResolvedValue(undefined),
  }
  const chainService = {
    jsonRpcProvider: {},
    getAccountsToTrack:
      fault === "accounts"
        ? jest.fn().mockRejectedValue(new Error("account lookup failed"))
        : jest.fn().mockResolvedValue([]),
  }
  const keyringService = {
    getSigner: jest.fn().mockResolvedValue({
      signer,
      address: FROM_ADDRESS,
      type: SignerSourceTypes.keyring,
    }),
  }

  const TestTransactionService = TransactionService as unknown as new (
    ...args: unknown[]
  ) => TransactionService
  const service = new TestTransactionService(
    db,
    chainService,
    keyringService,
    {}
  )
  const monitor = jest.fn()
  if (fault === "monitor") {
    monitor.mockImplementation(() => {
      throw new Error("monitor setup failed")
    })
  }
  ;(service as any).monitorQuaiTransaction = monitor

  if (fault === "activityEvent") {
    service.emitter.on("updateQuaiTransaction", async () => {
      throw new Error("activity event failed")
    })
  }
  if (fault === "sendEvent") {
    service.emitter.on("transactionSend", async () => {
      throw new Error("send event failed")
    })
  }

  const sendEvent = jest.fn()
  const failureEvent = jest.fn()
  service.emitter.on("transactionSend", sendEvent)
  service.emitter.on("transactionSendFailure", failureEvent)

  return {
    service,
    signer,
    db,
    chainService,
    monitor,
    sendEvent,
    failureEvent,
    transactionResponse,
  }
}

describe("Quai transaction broadcast boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each<[Fault]>([
    ["database"],
    ["accounts"],
    ["activityEvent"],
    ["sendEvent"],
    ["monitor"],
  ])(
    "returns an accepted transaction when %s reconciliation fails",
    async (fault) => {
      const fixture = createService(fault)

      await expect(
        fixture.service.signAndSendQuaiTransaction({
          from: FROM_ADDRESS,
          to: TO_ADDRESS,
          value: 1n,
        })
      ).resolves.toBe(fixture.transactionResponse)

      expect(fixture.signer.sendTransaction).toHaveBeenCalledTimes(1)
      expect(fixture.failureEvent).not.toHaveBeenCalled()
      expect(fixture.sendEvent).toHaveBeenCalledWith(TX_HASH)
      expect(fixture.monitor).toHaveBeenCalledWith(TX_HASH)
    }
  )

  it("still reports a failure when the broadcast itself is rejected", async () => {
    const fixture = createService()
    fixture.signer.sendTransaction.mockRejectedValue(
      new Error("broadcast rejected")
    )

    await expect(
      fixture.service.signAndSendQuaiTransaction({
        from: FROM_ADDRESS,
        to: TO_ADDRESS,
        value: 1n,
      })
    ).rejects.toThrow("broadcast rejected")

    expect(fixture.signer.sendTransaction).toHaveBeenCalledTimes(1)
    expect(fixture.failureEvent).toHaveBeenCalledTimes(1)
    expect(fixture.sendEvent).not.toHaveBeenCalled()
    expect(fixture.monitor).not.toHaveBeenCalled()
  })
})
