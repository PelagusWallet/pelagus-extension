import Emittery from "emittery"
import InternalQuaiProviderService from ".."

const request = (expiresAt: number, validUntil?: number) =>
  ({
    requestId: "qi-send-1",
    outputs: [
      {
        address: "0x0080000000000000000000000000000000000000",
        denomination: 0,
      },
    ],
    amountQit: "1",
    chainId: "15000",
    zone: "0x00",
    account: 0,
    maxFeeQit: "100",
    validUntil,
    origin: "https://app.test",
    prepared: {
      preparedId: "0xprepared",
      unsignedSerialized: "0xunsigned",
      digest: "0xdigest",
      requestFingerprint: "0xfingerprint",
      inputs: [],
      outputs: [],
      changeOutputs: [],
      amountQit: "1",
      feeQit: "10",
      maxFeeQit: "100",
      inputTotalQit: "11",
      totalDebitQit: "11",
      sourceAccount: 0,
      sourcePaymentCode: "QPSource",
      preparedAt: Date.now(),
      expiresAt,
    },
  } as any)

function createService() {
  const service = Object.create(InternalQuaiProviderService.prototype) as any
  service.emitter = new Emittery()
  service.qiSendRejecters = new Map()
  service.qiSendActiveRequestIds = new Set(["qi-send-1"])
  service.transactionsService = {
    discardPreparedDappQiSend: jest.fn(),
    isSendingPreparedDappQiSend: jest.fn().mockReturnValue(false),
  }
  return service
}

describe("InternalQuaiProviderService Qi confirmation lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-01-01T00:00:00Z"))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("expires a prepared request, clears its slot, and rejects the dapp", async () => {
    const service = createService()
    const rejected = jest.fn()
    service.emitter.on("qiSendToOutputsRejected", rejected)

    const promise = service.awaitQiSendConfirmation(
      "qi-send-1",
      request(Date.now() + 1000)
    )
    const expectation = expect(promise).rejects.toThrow(
      "Prepared Qi transaction expired"
    )

    jest.advanceTimersByTime(1000)
    await expectation

    expect(rejected).toHaveBeenCalledWith({ requestId: "qi-send-1" })
    expect(service.qiSendActiveRequestIds).not.toContain("qi-send-1")
    expect(
      service.transactionsService.discardPreparedDappQiSend
    ).toHaveBeenCalledWith("0xprepared")
  })

  it("expires a caller deadline while the confirmation popup is open", async () => {
    const service = createService()
    const rejected = jest.fn()
    service.emitter.on("qiSendToOutputsRejected", rejected)
    const deadline = Date.now() + 1000

    const promise = service.awaitQiSendConfirmation(
      "qi-send-1",
      request(deadline, deadline)
    )
    const expectation = expect(promise).rejects.toThrow(
      "funding deadline expired while awaiting confirmation"
    )

    jest.advanceTimersByTime(1000)
    await expectation

    expect(rejected).toHaveBeenCalledWith({ requestId: "qi-send-1" })
    expect(
      service.transactionsService.discardPreparedDappQiSend
    ).toHaveBeenCalledWith("0xprepared")
  })

  it("does not report user rejection after exact signing has started", async () => {
    const service = createService()
    service.transactionsService.isSendingPreparedDappQiSend.mockReturnValue(
      true
    )
    let resolveRequest: ((hash: string) => void) | undefined
    service.emitter.on("qiSendToOutputsRequest", ({ resolver }: any) => {
      resolveRequest = resolver
    })

    const promise = service.awaitQiSendConfirmation(
      "qi-send-1",
      request(Date.now() + 5000)
    )
    service.rejectQiSendToOutputs("qi-send-1")
    await Promise.resolve()

    expect(service.qiSendRejecters.has("qi-send-1")).toBe(true)
    resolveRequest?.("0xtx")
    await expect(promise).resolves.toBe("0xtx")
    expect(
      service.transactionsService.discardPreparedDappQiSend
    ).toHaveBeenCalledWith("0xprepared")
  })

  it("binds reservation allocation and commit RPCs to the trusted provider origin", async () => {
    const service = createService()
    service.transactionsService.getQiReceiveAddresses = jest
      .fn()
      .mockResolvedValue({ reservationId: "fill:payout", addresses: [] })
    service.transactionsService.commitQiReceiveAddressReservation = jest
      .fn()
      .mockResolvedValue({ reservationId: "fill:payout", status: "committed" })
    const lifecycleParams = {
      reservationId: "fill:payout",
      origin: "https://attacker.test",
      count: 1,
      zone: "cyprus1",
      account: 0,
    }

    await service.routeSafeRPCRequest(
      "qi_getReceiveAddresses",
      [lifecycleParams],
      "https://trusted.test"
    )
    await service.routeSafeRPCRequest(
      "qi_commitReceiveAddressReservation",
      [lifecycleParams],
      "https://trusted.test"
    )
    expect(
      service.transactionsService.getQiReceiveAddresses
    ).toHaveBeenCalledWith({
      reservationId: "fill:payout",
      origin: "https://trusted.test",
      count: 1,
      zone: "cyprus1",
      account: 0,
    })
    expect(
      service.transactionsService.commitQiReceiveAddressReservation
    ).toHaveBeenCalledWith({
      reservationId: "fill:payout",
      origin: "https://trusted.test",
      count: 1,
      zone: "cyprus1",
      account: 0,
    })
  })
})
