import { QiTransaction } from "quais"
import TransactionService, {
  getPreparedQiReviewFingerprint,
  getQiDappPreparedExpiry,
  getQiDappRequestFingerprint,
} from ".."
import {
  NormalizedQiSendToOutputsRequest,
  PreparedQiSendToOutputs,
} from "../types"

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
  reservationId?: unknown
  origin?: unknown
}) =>
  TransactionService.prototype.getQiReceiveAddresses.call(
    Object.create(TransactionService.prototype),
    {
      reservationId: "test:reservation",
      origin: "https://app.test",
      zone: "cyprus1",
      account: 0,
      ...input,
    }
  )

const normalizeQiSendToOutputsRequest = (input: unknown) =>
  TransactionService.prototype.normalizeQiSendToOutputsRequest.call(
    {
      chainService: {
        selectedNetwork: { chainID: "15000" },
      },
    },
    input as Parameters<
      TransactionService["normalizeQiSendToOutputsRequest"]
    >[0]
  )

const qiAddress = "0x0080000000000000000000000000000000000000"
const qiAddress2 = "0x0080000000000000000000000000000000000001"

const normalizedRequest: NormalizedQiSendToOutputsRequest = {
  outputs: [{ address: qiAddress, denomination: 0 }],
  amountQit: "1",
  chainId: "15000",
  zone: "0x00",
  account: 0,
  maxFeeQit: "100",
  origin: "https://app.test",
  label: "Fund trade",
}

const preparedReview: PreparedQiSendToOutputs = {
  preparedId: "0xprepared",
  unsignedSerialized: "0xunsigned",
  digest: "0xdigest",
  requestFingerprint: getQiDappRequestFingerprint(normalizedRequest),
  inputs: [
    {
      txhash: `0x${"ab".repeat(32)}`,
      index: 0,
      address: qiAddress2,
      denomination: 1,
      lock: 7,
      valueQit: "5",
      chainID: "15000",
      derivationPath: "BIP44:external",
    },
  ],
  outputs: normalizedRequest.outputs,
  changeOutputs: [],
  amountQit: "1",
  feeQit: "4",
  maxFeeQit: "100",
  inputTotalQit: "5",
  totalDebitQit: "5",
  sourceAccount: 0,
  sourcePaymentCode: "QPSource",
  preparedAt: 1000,
  expiresAt: 2000,
}

function createReceiveReservationHarness() {
  type Reservation = {
    origin: string
    reservationId: string
    account: number
    zone: string
    count: number
    addresses: string[]
    createdAt: number
    lastAccessedAt: number
    expiresAt: number
    status: "active" | "committed" | "released"
    committedAt?: number
    releasedAt?: number
    releaseReason?: "terminal" | "lease-expired"
  }
  const records = new Map<string, Reservation>()
  const addressInfos: Array<{
    address: string
    account: number
    status: string
    zone: string
  }> = []
  let nextAddressIndex = 1
  const makeAddress = (index: number) =>
    `0x0080${index.toString(16).padStart(36, "0")}`
  const wallet = {
    getAddressInfo: jest.fn((address: string) =>
      addressInfos.find((info) => info.address === address)
    ),
    getAddressesForZone: jest.fn(() => addressInfos),
    getChangeAddressesForZone: jest.fn(() => []),
    getNextAddressSync: jest.fn(() => {
      const info = {
        address: makeAddress(nextAddressIndex),
        account: 0,
        status: "UNKNOWN",
        zone: "0x00",
      }
      nextAddressIndex += 1
      addressInfos.push(info)
      return info
    }),
    serialize: jest.fn(() => ({ wallet: "serialized" })),
  }
  const key = (origin: string, reservationId: string) =>
    `${origin}\u0000${reservationId}`
  const db = {
    expireActiveQiReceiveAddressReservations: jest.fn(async (now: number) => {
      records.forEach((record, recordKey) => {
        if (record.status === "active" && record.expiresAt <= now) {
          records.set(recordKey, {
            ...record,
            status: "released",
            releasedAt: now,
            releaseReason: "lease-expired",
          })
        }
      })
    }),
    getQiReceiveAddressReservation: jest.fn(
      async (origin: string, reservationId: string) =>
        records.get(key(origin, reservationId))
    ),
    putQiReceiveAddressReservation: jest.fn(async (record: Reservation) => {
      records.set(key(record.origin, record.reservationId), {
        ...record,
        addresses: [...record.addresses],
      })
    }),
    getUnreleasedQiReceiveAddressReservations: jest.fn(async () =>
      [...records.values()].filter(
        (record) => record.status === "active" || record.status === "committed"
      )
    ),
  }
  const vaultManager = { add: jest.fn().mockResolvedValue(undefined) }
  const createService = () => {
    const service = Object.create(TransactionService.prototype) as any
    service.db = db
    service.keyringService = {
      getQiHDWallet: jest.fn().mockResolvedValue(wallet),
      vaultManager,
    }
    service.indexingService = {
      getQiCoinbaseAddresses: jest.fn().mockResolvedValue([]),
    }
    service.qiReceiveAddressAllocationQueue = Promise.resolve()
    return service as TransactionService
  }
  return { createService, db, records, wallet, vaultManager }
}

describe("TransactionService", () => {
  describe("getQiReceiveAddresses", () => {
    it.each([true, [], " ", "0x10"])(
      "rejects coerced count value %p",
      async (count) => {
        await expect(getQiReceiveAddresses({ count })).rejects.toThrow(
          "count must be an integer between 1 and 4"
        )
      }
    )

    it("rejects oversized address batches", async () => {
      await expect(getQiReceiveAddresses({ count: 5 })).rejects.toThrow(
        "count must be an integer between 1 and 4"
      )
    })

    it("rejects nonzero account indexes", async () => {
      await expect(getQiReceiveAddresses({ account: 1 })).rejects.toThrow(
        "account must be 0"
      )
    })

    it("requires a durable reservation id", async () => {
      await expect(
        getQiReceiveAddresses({ reservationId: undefined })
      ).rejects.toThrow("reservationId must use")
    })

    it("durably returns the same origin-bound reservation after restart", async () => {
      const harness = createReceiveReservationHarness()
      const request = {
        reservationId: "quote-1:buyer-payout",
        origin: "https://app.test",
        count: 2,
        zone: "cyprus1",
        account: 0,
      }
      const first = await harness.createService().getQiReceiveAddresses(request)
      const retried = await harness
        .createService()
        .getQiReceiveAddresses(request)

      expect(first).toMatchObject({ reservationId: request.reservationId })
      expect(retried).toMatchObject({
        reservationId: request.reservationId,
        addresses: (first as { addresses: string[] }).addresses,
      })
      expect(harness.wallet.getNextAddressSync).toHaveBeenCalledTimes(2)
      expect(harness.records.size).toBe(1)
    })

    it("keeps a committed reservation bound indefinitely across restart", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000)
      try {
        const harness = createReceiveReservationHarness()
        const request = {
          reservationId: "fill-committed:payout",
          origin: "https://app.test",
          count: 1,
          zone: "cyprus1",
          account: 0,
        }
        const service = harness.createService()
        const active = (await service.getQiReceiveAddresses(request)) as {
          addresses: string[]
        }
        const committed = await service.commitQiReceiveAddressReservation(
          request
        )
        const committedRetry = await harness
          .createService()
          .commitQiReceiveAddressReservation(request)

        expect(committed).toMatchObject({
          reservationId: request.reservationId,
          addresses: active.addresses,
          status: "committed",
          expiresAt: null,
          committedAt: 1000,
        })
        expect(committedRetry).toEqual(committed)

        now.mockReturnValue(1000 + 2 * 24 * 60 * 60 * 1000)
        const afterOriginalExpiry = await harness
          .createService()
          .getQiReceiveAddresses(request)
        const next = (await harness.createService().getQiReceiveAddresses({
          ...request,
          reservationId: "fill-next:payout",
        })) as { addresses: string[] }

        expect(afterOriginalExpiry).toEqual(committed)
        expect(next.addresses[0]).not.toBe(active.addresses[0])
        expect(
          harness.records.get(`${request.origin}\u0000${request.reservationId}`)
            ?.status
        ).toBe("committed")
      } finally {
        now.mockRestore()
      }
    })

    it("releases only committed terminal reservations and is idempotent after restart", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(5000)
      try {
        const harness = createReceiveReservationHarness()
        const request = {
          reservationId: "fill-terminal:refund",
          origin: "https://app.test",
          count: 1,
          zone: "cyprus1",
          account: 0,
        }
        const service = harness.createService()
        const active = (await service.getQiReceiveAddresses(request)) as {
          addresses: string[]
        }

        await expect(
          service.releaseQiReceiveAddressReservation({
            ...request,
            reason: "terminal",
          })
        ).rejects.toThrow("Only a committed reservation")
        await service.commitQiReceiveAddressReservation(request)
        const released = await service.releaseQiReceiveAddressReservation({
          ...request,
          reason: "terminal",
        })
        const releasedRetry = await harness
          .createService()
          .releaseQiReceiveAddressReservation({
            ...request,
            reason: "terminal",
          })

        expect(released).toEqual({
          reservationId: request.reservationId,
          status: "released",
          releasedAt: 5000,
          alreadyReleased: false,
        })
        expect(releasedRetry).toEqual({
          ...released,
          alreadyReleased: true,
        })
        await expect(
          harness.createService().getQiReceiveAddresses(request)
        ).rejects.toThrow("released and cannot be reused")

        const replacement = (await harness
          .createService()
          .getQiReceiveAddresses({
            ...request,
            reservationId: "fill-replacement:refund",
          })) as { addresses: string[] }
        expect(replacement.addresses).toEqual(active.addresses)
      } finally {
        now.mockRestore()
      }
    })

    it("turns an expired active reservation into a non-replayable tombstone", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1000)
      try {
        const harness = createReceiveReservationHarness()
        const request = {
          reservationId: "quote-expired:payout",
          origin: "https://app.test",
          count: 1,
          zone: "cyprus1",
          account: 0,
        }
        await harness.createService().getQiReceiveAddresses(request)
        now.mockReturnValue(1000 + 24 * 60 * 60 * 1000 + 1)

        await expect(
          harness.createService().getQiReceiveAddresses(request)
        ).rejects.toThrow("released and cannot be reused")
        await expect(
          harness.createService().commitQiReceiveAddressReservation(request)
        ).rejects.toThrow("cannot be committed or reused")
        expect(
          harness.records.get(`${request.origin}\u0000${request.reservationId}`)
            ?.releaseReason
        ).toBe("lease-expired")
      } finally {
        now.mockRestore()
      }
    })

    it("binds commit and release to the trusted origin and exact parameters", async () => {
      const harness = createReceiveReservationHarness()
      const service = harness.createService()
      const request = {
        reservationId: "fill-bound:payout",
        origin: "https://owner.test",
        count: 1,
        zone: "cyprus1",
        account: 0,
      }
      await service.getQiReceiveAddresses(request)

      await expect(
        service.commitQiReceiveAddressReservation({
          ...request,
          origin: "https://other.test",
        })
      ).rejects.toThrow("was not found")
      await expect(
        service.commitQiReceiveAddressReservation({ ...request, count: 2 })
      ).rejects.toThrow("different count, zone, or account")
      await expect(
        service.commitQiReceiveAddressReservation({ ...request, account: 1 })
      ).rejects.toThrow("account must be 0")
      await expect(
        service.commitQiReceiveAddressReservation({
          ...request,
          zone: "cyprus2",
        })
      ).rejects.toThrow("Qi is not supported")

      await service.commitQiReceiveAddressReservation(request)
      await expect(
        service.releaseQiReceiveAddressReservation({
          ...request,
          origin: "https://other.test",
          reason: "terminal",
        })
      ).rejects.toThrow("was not found")
      await expect(
        service.releaseQiReceiveAddressReservation({
          ...request,
          reason: "abandoned-before-acceptance",
        })
      ).rejects.toThrow('reason must be "terminal"')
    })

    it("returns distinct addresses for distinct reservations", async () => {
      const harness = createReceiveReservationHarness()
      const service = harness.createService()
      const first = (await service.getQiReceiveAddresses({
        reservationId: "fill-1:payout",
        origin: "https://app.test",
        count: 1,
      })) as { addresses: string[] }
      const second = (await service.getQiReceiveAddresses({
        reservationId: "fill-2:payout",
        origin: "https://app.test",
        count: 1,
      })) as { addresses: string[] }
      expect(second.addresses[0]).not.toBe(first.addresses[0])
    })

    it("enforces the restore-gap budget from the first reservation", async () => {
      const harness = createReceiveReservationHarness()
      const service = harness.createService()
      await expect(
        service.getQiReceiveAddresses({
          reservationId: "fill-too-large:refund",
          origin: "https://app.test",
          count: 5,
        })
      ).rejects.toThrow("between 1 and 4")

      await service.getQiReceiveAddresses({
        reservationId: "fill-1:refund",
        origin: "https://app.test",
        count: 4,
      })

      await expect(
        service.getQiReceiveAddresses({
          reservationId: "fill-1:refund",
          origin: "https://app.test",
          count: 3,
        })
      ).rejects.toThrow("already exists with different count")
      await expect(
        service.getQiReceiveAddresses({
          reservationId: "fill-2:refund",
          origin: "https://app.test",
          count: 1,
        })
      ).rejects.toThrow("cannot exceed 4 unresolved addresses")
    })

    it("binds the same reservationId independently to each trusted origin", async () => {
      const harness = createReceiveReservationHarness()
      const service = harness.createService()
      const first = (await service.getQiReceiveAddresses({
        reservationId: "fill:payout",
        origin: "https://one.test",
        count: 1,
      })) as { addresses: string[] }
      const second = (await service.getQiReceiveAddresses({
        reservationId: "fill:payout",
        origin: "https://two.test",
        count: 1,
      })) as { addresses: string[] }

      expect(second.addresses[0]).not.toBe(first.addresses[0])
    })

    it("requires a trusted origin and Cyprus1 for reservation mode", async () => {
      const service = createReceiveReservationHarness().createService()
      await expect(
        service.getQiReceiveAddresses({
          reservationId: "fill:payout",
          count: 1,
        })
      ).rejects.toThrow("origin is required")
      await expect(
        service.getQiReceiveAddresses({
          reservationId: "fill:payout",
          origin: "https://app.test",
          zone: "cyprus2",
          count: 1,
        })
      ).rejects.toThrow("Qi is not supported")
    })
  })

  describe("normalizeQiSendToOutputsRequest", () => {
    it("normalizes a safe caller deadline and rejects expired or distant values", () => {
      const now = Date.parse("2026-01-01T00:00:00Z")
      const dateNow = jest.spyOn(Date, "now").mockReturnValue(now)
      const baseRequest = {
        chainId: "15000",
        zone: "0x00",
        maxFeeQit: "100",
        outputs: [{ address: qiAddress, denomination: 0 }],
      }

      try {
        expect(
          normalizeQiSendToOutputsRequest({
            ...baseRequest,
            validUntil: String(now + 60_000),
          })
        ).toMatchObject({ validUntil: now + 60_000 })
        expect(() =>
          normalizeQiSendToOutputsRequest({
            ...baseRequest,
            validUntil: now,
          })
        ).toThrow("validUntil has expired")
        expect(() =>
          normalizeQiSendToOutputsRequest({
            ...baseRequest,
            validUntil: now + 181 * 24 * 60 * 60 * 1000,
          })
        ).toThrow("validUntil is unreasonably far in the future")
        expect(() =>
          normalizeQiSendToOutputsRequest({
            ...baseRequest,
            validUntil: "9007199254740992",
          })
        ).toThrow("positive safe epoch millisecond")
      } finally {
        dateNow.mockRestore()
      }
    })

    it("rejects unsafe JS number qit amounts", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "15000",
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
          chainId: "15000",
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

    it("requires an explicit chain id for dapp-originated Qi sends", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          zone: "0x00",
          outputs: [{ address: qiAddress, denomination: 0 }],
        })
      ).toThrow("chainId is required for Qi dapp sends")
    })

    it.each(["txOutputs", "qiOutputs", "qiEscrowOutputs"])(
      "rejects the unsupported %s output alias",
      (field) => {
        expect(() =>
          normalizeQiSendToOutputsRequest({
            chainId: "15000",
            zone: "0x00",
            maxFeeQit: "100",
            [field]: [{ address: qiAddress, denomination: 0 }],
          } as any)
        ).toThrow(`${field} is not supported; use the canonical outputs field`)
      }
    )

    it("normalizes a hex chain id and binds it to the selected wallet network", () => {
      expect(
        normalizeQiSendToOutputsRequest({
          chainId: "0x3a98",
          zone: "0x00",
          maxFeeQit: "100",
          outputs: [{ address: qiAddress, denomination: 0 }],
        })
      ).toMatchObject({ chainId: "15000", maxFeeQit: "100" })
    })

    it("rejects a request for a different wallet network", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "9",
          zone: "0x00",
          outputs: [{ address: qiAddress, denomination: 0 }],
        })
      ).toThrow(
        "Qi request chainId 9 does not match the selected wallet network 15000"
      )
    })

    it("rejects the legacy chainID alias", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "15000",
          chainID: "9",
          zone: "0x00",
          outputs: [{ address: qiAddress, denomination: 0 }],
        } as any)
      ).toThrow("chainID is not supported; use chainId")
    })

    it("requires a positive integer fee cap", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "15000",
          zone: "0x00",
          outputs: [{ address: qiAddress, denomination: 0 }],
        })
      ).toThrow("maxFeeQit is required")

      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "15000",
          zone: "0x00",
          maxFeeQit: Number.MAX_SAFE_INTEGER + 1,
          outputs: [{ address: qiAddress, denomination: 0 }],
        })
      ).toThrow("maxFeeQit must be an integer qit amount")
    })

    it("pins public dapp sends to account 0", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "15000",
          zone: "0x00",
          account: 1,
          maxFeeQit: "100",
          outputs: [{ address: qiAddress, denomination: 0 }],
        })
      ).toThrow("account must be 0 for Qi dapp sends")
    })

    it("rejects case-variant duplicate output addresses", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "15000",
          zone: "0x00",
          maxFeeQit: "100",
          outputs: [
            { address: qiAddress, denomination: 0 },
            {
              address: qiAddress.toUpperCase().replace("0X", "0x"),
              denomination: 1,
            },
          ],
        })
      ).toThrow("Qi output address reused")
    })

    it("bounds dapp metadata and transaction data", () => {
      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "15000",
          zone: "0x00",
          maxFeeQit: "100",
          label: "x".repeat(121),
          outputs: [{ address: qiAddress, denomination: 0 }],
        })
      ).toThrow("label cannot exceed 120 characters")

      expect(() =>
        normalizeQiSendToOutputsRequest({
          chainId: "15000",
          zone: "0x00",
          maxFeeQit: "100",
          data: `0x${"00".repeat(1025)}`,
          outputs: [{ address: qiAddress, denomination: 0 }],
        })
      ).toThrow("data cannot exceed 1024 bytes")
    })
  })

  describe("prepared Qi review binding", () => {
    it("uses the v1 request fingerprint domain", () => {
      expect(getQiDappRequestFingerprint(normalizedRequest)).toBe(
        "0x9cefbab3660235dbd67fbad7b0c1c20736e35848067fd1434691c72722e6a1b9"
      )
    })

    it("changes the request fingerprint when rendered origin or outputs change", () => {
      expect(
        getQiDappRequestFingerprint({
          ...normalizedRequest,
          origin: "https://other.test",
        })
      ).not.toBe(getQiDappRequestFingerprint(normalizedRequest))
      expect(
        getQiDappRequestFingerprint({
          ...normalizedRequest,
          outputs: [{ address: qiAddress2, denomination: 0 }],
        })
      ).not.toBe(getQiDappRequestFingerprint(normalizedRequest))
    })

    it("binds caller deadline changes into the request fingerprint", () => {
      const withDeadline = {
        ...normalizedRequest,
        validUntil: Date.now() + 60_000,
      }
      const baseline = getQiDappRequestFingerprint(withDeadline)

      expect(
        getQiDappRequestFingerprint({
          ...withDeadline,
          validUntil: withDeadline.validUntil + 1,
        })
      ).not.toBe(baseline)
      expect(
        getQiDappRequestFingerprint({
          ...withDeadline,
          validUntil: undefined,
        })
      ).not.toBe(baseline)
    })

    it("uses the earlier of the wallet TTL and caller deadline", () => {
      const preparedAt = Date.parse("2026-01-01T00:00:00Z")

      expect(getQiDappPreparedExpiry(preparedAt)).toBe(preparedAt + 300_000)
      expect(getQiDappPreparedExpiry(preparedAt, preparedAt + 30_000)).toBe(
        preparedAt + 30_000
      )
      expect(getQiDappPreparedExpiry(preparedAt, preparedAt + 600_000)).toBe(
        preparedAt + 300_000
      )
    })

    it("changes the review fingerprint when fee, input lock, or expiry changes", () => {
      const baseline = getPreparedQiReviewFingerprint(preparedReview)
      expect(
        getPreparedQiReviewFingerprint({ ...preparedReview, feeQit: "5" })
      ).not.toBe(baseline)
      expect(
        getPreparedQiReviewFingerprint({
          ...preparedReview,
          inputs: [{ ...preparedReview.inputs[0], lock: 8 }],
        })
      ).not.toBe(baseline)
      expect(
        getPreparedQiReviewFingerprint({ ...preparedReview, expiresAt: 2001 })
      ).not.toBe(baseline)
    })

    it("serializes preparation and signing before the first await", async () => {
      const service = Object.create(TransactionService.prototype) as any
      service.preparedDappQiSend = null
      service.preparingDappQiSend = false
      service.signingDappQiSend = false

      let finishPreparation:
        | ((value: PreparedQiSendToOutputs) => void)
        | undefined
      service.prepareReservedQiSendToOutputs = jest.fn(
        () =>
          new Promise<PreparedQiSendToOutputs>((resolve) => {
            finishPreparation = resolve
          })
      )
      const firstPreparation = service.prepareQiSendToOutputs(normalizedRequest)
      await expect(
        service.prepareQiSendToOutputs(normalizedRequest)
      ).rejects.toThrow("Another Qi transaction is awaiting confirmation")
      finishPreparation?.(preparedReview)
      await expect(firstPreparation).resolves.toBe(preparedReview)

      let finishSend: ((value: string) => void) | undefined
      service.sendPreparedQiToOutputs = jest.fn(
        () =>
          new Promise<string>((resolve) => {
            finishSend = resolve
          })
      )
      const firstSend = service.sendQiToOutputs(normalizedRequest)
      await expect(service.sendQiToOutputs(normalizedRequest)).rejects.toThrow(
        "already being sent"
      )
      finishSend?.("0xtx")
      await expect(firstSend).resolves.toBe("0xtx")
    })

    it("broadcasts the exact review once and stops if its deadline expires during signing", async () => {
      const inputAddress = "0x0080000000000000000000000000000000000010"
      const recipientAddress = "0x0080000000000000000000000000000000000020"
      const changeOutputs = [1, 2, 3, 4].map((index) => ({
        address: `0x008000000000000000000000000000000000003${index}`,
        denomination: 2,
      }))
      const pubKey = `0x03${"22".repeat(32)}`
      const txHash = `0x${"ab".repeat(32)}`
      const tx = new QiTransaction()
      tx.type = 2
      tx.chainId = 15000
      tx.txInputs = [{ txhash: txHash, index: 0, pubkey: pubKey }]
      tx.txOutputs = [
        { address: recipientAddress, denomination: 3 },
        ...changeOutputs,
      ]

      const exactRequest: NormalizedQiSendToOutputsRequest = {
        outputs: [{ address: recipientAddress, denomination: 3 }],
        amountQit: "50",
        chainId: "15000",
        zone: "0x00",
        account: 0,
        maxFeeQit: "100",
        origin: "https://app.test",
      }
      const exactPrepared: PreparedQiSendToOutputs = {
        preparedId: tx.digest,
        unsignedSerialized: tx.unsignedSerialized,
        digest: tx.digest,
        requestFingerprint: getQiDappRequestFingerprint(exactRequest),
        inputs: [
          {
            txhash: txHash,
            index: 0,
            address: inputAddress,
            denomination: 4,
            lock: 7,
            valueQit: "100",
            chainID: "15000",
            derivationPath: "BIP44:external",
          },
        ],
        outputs: exactRequest.outputs,
        changeOutputs,
        amountQit: "50",
        feeQit: "10",
        maxFeeQit: "100",
        inputTotalQit: "100",
        totalDebitQit: "60",
        sourceAccount: 0,
        sourcePaymentCode: "QPSource",
        preparedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }
      const signTransaction = jest.fn(async (reviewedTx: QiTransaction) => {
        expect(reviewedTx.digest).toBe(tx.digest)
        return "0xsigned"
      })
      const addressInfo = (address: string) => ({
        address,
        account: 0,
        zone: "0x00",
        derivationPath:
          address === inputAddress ? "BIP44:external" : "BIP44:change",
        pubKey,
      })
      const wallet = {
        connect: jest.fn(),
        getPaymentCode: jest.fn(() => "QPSource"),
        getAddressInfo: jest.fn(addressInfo),
        importOutpoints: jest.fn(),
        signTransaction,
        serialize: jest.fn(() => ({ wallet: "serialized" })),
      }
      const broadcastTransaction = jest.fn().mockResolvedValue({
        hash: "0xtx",
        chainId: 15000,
        blockHash: null,
        blockNumber: null,
      })
      const service = Object.create(TransactionService.prototype) as any
      service.signingDappQiSend = false
      service.preparingDappQiSend = false
      service.preparedDappQiSend = exactPrepared
      service.chainService = {
        selectedNetwork: { chainID: "15000" },
        jsonRpcProvider: { broadcastTransaction },
        getAllQiOutpoints: jest.fn().mockResolvedValue([
          {
            chainID: "15000",
            outpoint: { txhash: txHash, index: 0, denomination: 4, lock: 7 },
            value: 100n,
            address: inputAddress,
            derivationPath: "BIP44:external",
          },
        ]),
        removeQiOutpoints: jest.fn().mockResolvedValue(undefined),
        syncQiWallet: jest.fn().mockResolvedValue(undefined),
      }
      service.keyringService = {
        getQiHDWallet: jest.fn().mockResolvedValue(wallet),
        vaultManager: { add: jest.fn().mockResolvedValue(undefined) },
      }
      service.saveQiTransaction = jest.fn().mockResolvedValue(undefined)
      service.subscribeToQiTransaction = jest.fn().mockResolvedValue(undefined)

      await expect(
        service.sendQiToOutputs({
          ...exactRequest,
          prepared: exactPrepared,
        })
      ).resolves.toBe("0xtx")
      expect(signTransaction).toHaveBeenCalledTimes(1)
      expect(broadcastTransaction).toHaveBeenCalledWith("0x00", "0xsigned")
      expect(service.preparedDappQiSend).toBeNull()

      const beforeSigning = Date.now()
      let currentTime = beforeSigning
      const fundingDeadline = beforeSigning + 1000
      const expiringRequest: NormalizedQiSendToOutputsRequest = {
        ...exactRequest,
        validUntil: fundingDeadline,
      }
      const expiringPrepared: PreparedQiSendToOutputs = {
        ...exactPrepared,
        requestFingerprint: getQiDappRequestFingerprint(expiringRequest),
        preparedAt: beforeSigning,
        expiresAt: fundingDeadline,
      }
      service.preparedDappQiSend = expiringPrepared
      const dateNow = jest
        .spyOn(Date, "now")
        .mockImplementation(() => currentTime)
      signTransaction.mockImplementationOnce(async () => {
        currentTime = fundingDeadline
        return "0xexpired-signature"
      })

      try {
        await expect(
          service.sendQiToOutputs({
            ...expiringRequest,
            prepared: expiringPrepared,
          })
        ).rejects.toThrow("funding deadline expired before broadcast")
      } finally {
        dateNow.mockRestore()
      }
      expect(signTransaction).toHaveBeenCalledTimes(2)
      expect(broadcastTransaction).toHaveBeenCalledTimes(1)
      expect(service.preparedDappQiSend).toBeNull()
    })
  })
})
