import { QiTransactionResponse } from "quais/lib/commonjs/providers"

import TransactionService from ".."
import NotificationsManager from "../../notifications"
import { TransactionStatus } from "../types"

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
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined),
      },
    },
  },
}))
jest.mock("../../notifications", () => ({
  __esModule: true,
  default: {
    createFailedQiTxNotification: jest.fn(),
  },
}))

const TX_HASH = `0x00${"03".repeat(31)}`
const TO_ADDRESS = "0x0000000000000000000000000000000000000002"
const REFUND_ADDRESS = "0x0000000000000000000000000000000000000003"

type Fault = "outpoints" | "vault" | "activity" | "monitor"

function createService(fault?: Fault) {
  const response = {
    hash: TX_HASH,
    chainId: 9n,
    blockHash: null,
    blockNumber: null,
  } as unknown as QiTransactionResponse
  const outpoints = [
    {
      outpoint: {
        txhash: `0x00${"04".repeat(31)}`,
        index: 0,
        denomination: 0,
        lock: 0,
      },
      value: 1n,
      address: "0x0000000000000000000000000000000000000001",
      derivationPath: "BIP44:0:0:0",
      chainID: "9",
    },
  ]
  const qiWallet = {
    connect: jest.fn(),
    importOutpoints: jest.fn(),
    convertToQuai: jest.fn().mockResolvedValue(response),
    serialize: jest.fn().mockReturnValue("serialized-wallet"),
    getPaymentCode: jest.fn().mockReturnValue("sender-payment-code"),
    getNextAddressSync: jest.fn().mockReturnValue({
      address: REFUND_ADDRESS,
    }),
  }
  const db = {
    addOrUpdateQiTransaction:
      fault === "activity"
        ? jest.fn().mockRejectedValue(new Error("activity write failed"))
        : jest.fn().mockResolvedValue(undefined),
  }
  const chainService = {
    jsonRpcProvider: {},
    selectedNetwork: { chainID: "9" },
    getOutpointsForSending: jest.fn().mockResolvedValue(outpoints),
    removeQiOutpoints:
      fault === "outpoints"
        ? jest.fn().mockRejectedValue(new Error("outpoint removal failed"))
        : jest.fn().mockResolvedValue(undefined),
    syncQiWallet: jest.fn().mockResolvedValue(undefined),
  }
  const keyringService = {
    getQiHDWallet: jest.fn().mockResolvedValue(qiWallet),
    vaultManager: {
      add:
        fault === "vault"
          ? jest.fn().mockRejectedValue(new Error("vault write failed"))
          : jest.fn().mockResolvedValue(undefined),
    },
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
  const monitor =
    fault === "monitor"
      ? jest.fn().mockRejectedValue(new Error("monitor failed"))
      : jest.fn().mockResolvedValue(undefined)
  ;(service as any).monitorConversion = monitor
  ;(service as any).subscribeToQiTransaction = monitor

  return {
    service,
    qiWallet,
    db,
    chainService,
    keyringService,
    monitor,
  }
}

function expectSinglePendingReconciliation(
  fixture: ReturnType<typeof createService>,
  fault: Fault
) {
  const { qiWallet, db, chainService, keyringService, monitor } = fixture

  expect(qiWallet.convertToQuai).toHaveBeenCalledTimes(1)
  expect(chainService.removeQiOutpoints).toHaveBeenCalledTimes(1)
  expect(keyringService.vaultManager.add).toHaveBeenCalledTimes(1)
  expect(db.addOrUpdateQiTransaction).toHaveBeenCalledTimes(1)
  expect(monitor).toHaveBeenCalledTimes(fault === "activity" ? 0 : 1)
  expect(
    NotificationsManager.createFailedQiTxNotification
  ).not.toHaveBeenCalled()

  if (fault !== "activity") {
    expect(db.addOrUpdateQiTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: TX_HASH,
        status: TransactionStatus.PENDING,
      })
    )
  }
}

describe("Qi conversion broadcast boundaries", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each<[Fault]>([["outpoints"], ["vault"], ["activity"], ["monitor"]])(
    "does not rebroadcast Qi-to-Quai when %s reconciliation fails",
    async (fault) => {
      const fixture = createService(fault)

      await expect(
        fixture.service.convertQiToQuai(TO_ADDRESS, "1", 100)
      ).resolves.toBe(TX_HASH)

      expectSinglePendingReconciliation(fixture, fault)
    }
  )

  it.each<[Fault]>([["outpoints"], ["vault"], ["activity"], ["monitor"]])(
    "does not rebroadcast wrapped Qi when %s reconciliation fails",
    async (fault) => {
      const fixture = createService(fault)

      await expect(fixture.service.wrapQi("1", TO_ADDRESS)).resolves.toBe(
        TX_HASH
      )

      expectSinglePendingReconciliation(fixture, fault)
    }
  )
})
