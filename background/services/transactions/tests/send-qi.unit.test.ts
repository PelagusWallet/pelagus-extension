import { QiTransactionResponse } from "quais/lib/commonjs/providers"
import browser from "webextension-polyfill"

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
    createSendQiTxNotification: jest.fn(),
    createFailedQiTxNotification: jest.fn(),
  },
}))

const TX_HASH = `0x00${"01".repeat(31)}`
const SENDER_PAYMENT_CODE = "sender-payment-code"
const RECEIVER_PAYMENT_CODE = "receiver-payment-code"

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
        txhash: `0x00${"02".repeat(31)}`,
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
    channelIsOpen: jest.fn().mockReturnValue(true),
    openChannel: jest.fn(),
    sendTransaction: jest.fn().mockResolvedValue(response),
    serialize: jest.fn().mockReturnValue("serialized-wallet"),
    getPaymentCode: jest.fn().mockReturnValue(SENDER_PAYMENT_CODE),
  }
  const db = {
    addOrUpdateQiTransaction:
      fault === "activity"
        ? jest.fn().mockRejectedValue(new Error("activity write failed"))
        : jest.fn().mockResolvedValue(undefined),
    getQiTransactionByHash: jest.fn().mockResolvedValue(undefined),
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
  ;(service as any).subscribeToQiTransaction = monitor
  service.doesChannelExistForReceiver = jest.fn().mockResolvedValue(true)

  return {
    service,
    qiWallet,
    db,
    chainService,
    keyringService,
    monitor,
  }
}

describe("sendQiTransaction broadcast boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(browser.storage.local.get as jest.Mock).mockResolvedValue({})
    ;(browser.storage.local.set as jest.Mock).mockResolvedValue(undefined)
  })

  it.each<[Fault]>([["outpoints"], ["vault"], ["activity"], ["monitor"]])(
    "does not rebroadcast or report failure when %s reconciliation fails",
    async (fault) => {
      const { service, qiWallet, db, chainService, keyringService, monitor } =
        createService(fault)

      await expect(
        service.sendQiTransaction(
          1n,
          "0x0000000000000000000000000000000000000002",
          SENDER_PAYMENT_CODE,
          RECEIVER_PAYMENT_CODE
        )
      ).resolves.toBe(TX_HASH)

      expect(qiWallet.sendTransaction).toHaveBeenCalledTimes(1)
      expect(chainService.removeQiOutpoints).toHaveBeenCalledTimes(1)
      expect(keyringService.vaultManager.add).toHaveBeenCalledTimes(1)
      expect(db.addOrUpdateQiTransaction).toHaveBeenCalledTimes(1)
      expect(monitor).toHaveBeenCalledTimes(fault === "activity" ? 0 : 1)
      expect(
        NotificationsManager.createSendQiTxNotification
      ).toHaveBeenCalledTimes(1)
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
  )

  it("retries rejected broadcasts before a hash exists", async () => {
    const { service, qiWallet } = createService()
    qiWallet.sendTransaction
      .mockRejectedValueOnce(new Error("temporary broadcast failure"))
      .mockResolvedValueOnce({
        hash: TX_HASH,
        chainId: 9n,
        blockHash: null,
        blockNumber: null,
      })

    await expect(
      service.sendQiTransaction(
        1n,
        "0x0000000000000000000000000000000000000002",
        SENDER_PAYMENT_CODE,
        RECEIVER_PAYMENT_CODE
      )
    ).resolves.toBe(TX_HASH)

    expect(qiWallet.sendTransaction).toHaveBeenCalledTimes(2)
    expect(
      NotificationsManager.createFailedQiTxNotification
    ).not.toHaveBeenCalled()
  })

  it("does not rebroadcast after a resolved response without a hash", async () => {
    const { service, qiWallet } = createService()
    qiWallet.sendTransaction.mockResolvedValue({ chainId: 9n })

    await expect(
      service.sendQiTransaction(
        1n,
        "0x0000000000000000000000000000000000000002",
        SENDER_PAYMENT_CODE,
        RECEIVER_PAYMENT_CODE
      )
    ).rejects.toThrow(
      "Qi broadcast completed without returning a transaction hash"
    )

    expect(qiWallet.sendTransaction).toHaveBeenCalledTimes(1)
  })

  it("leaves a known transaction pending when confirmation times out", async () => {
    const { service, db, chainService } = createService()
    const pendingTransaction = {
      hash: TX_HASH,
      status: TransactionStatus.PENDING,
    }
    db.getQiTransactionByHash.mockResolvedValue(pendingTransaction)

    await (service as any).handleQiTransactionTimeout(TX_HASH)

    expect(pendingTransaction.status).toBe(TransactionStatus.PENDING)
    expect(db.addOrUpdateQiTransaction).not.toHaveBeenCalled()
    expect(chainService.syncQiWallet).toHaveBeenCalledWith({
      requireFreshScan: true,
    })
    expect(
      NotificationsManager.createFailedQiTxNotification
    ).not.toHaveBeenCalled()
  })

  it("returns the hash without waiting for confirmation monitoring", async () => {
    const { service, monitor } = createService()
    let finishMonitor: (() => void) | undefined
    monitor.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishMonitor = resolve
        })
    )

    const sendPromise = service.sendQiTransaction(
      1n,
      "0x0000000000000000000000000000000000000002",
      SENDER_PAYMENT_CODE,
      RECEIVER_PAYMENT_CODE
    )
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<string>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("send waited for confirmation")),
        100
      )
    })

    await expect(Promise.race([sendPromise, timeoutPromise])).resolves.toBe(
      TX_HASH
    )
    if (timeout) clearTimeout(timeout)
    expect(monitor).toHaveBeenCalledTimes(1)

    finishMonitor?.()
    await sendPromise
  })

  it("journals and retries a pending database write before monitoring", async () => {
    const { service, db, monitor, qiWallet } = createService()
    db.addOrUpdateQiTransaction
      .mockRejectedValueOnce(new Error("temporary database failure"))
      .mockResolvedValueOnce(undefined)

    await expect(
      service.sendQiTransaction(
        1n,
        "0x0000000000000000000000000000000000000002",
        SENDER_PAYMENT_CODE,
        RECEIVER_PAYMENT_CODE
      )
    ).resolves.toBe(TX_HASH)

    expect(qiWallet.sendTransaction).toHaveBeenCalledTimes(1)
    expect(db.addOrUpdateQiTransaction).toHaveBeenCalledTimes(1)
    expect(monitor).not.toHaveBeenCalled()
    expect(browser.storage.local.set).toHaveBeenCalledWith({
      pendingQiBroadcasts: {
        [TX_HASH]: expect.objectContaining({
          hash: TX_HASH,
          status: TransactionStatus.PENDING,
        }),
      },
    })

    await (service as any).recoverPendingQiBroadcasts()
    await Promise.resolve()

    expect(db.addOrUpdateQiTransaction).toHaveBeenCalledTimes(2)
    expect(monitor).toHaveBeenCalledTimes(1)
    expect(
      NotificationsManager.createFailedQiTxNotification
    ).not.toHaveBeenCalled()
  })

  it("recovers a journaled broadcast after the service is recreated", async () => {
    const firstService = createService()
    firstService.db.addOrUpdateQiTransaction.mockRejectedValueOnce(
      new Error("temporary database failure")
    )

    await firstService.service.sendQiTransaction(
      1n,
      "0x0000000000000000000000000000000000000002",
      SENDER_PAYMENT_CODE,
      RECEIVER_PAYMENT_CODE
    )

    const journalWrite = (browser.storage.local.set as jest.Mock).mock
      .calls[0][0]
    const restartedService = createService()
    ;(browser.storage.local.get as jest.Mock).mockResolvedValue(journalWrite)

    await (restartedService.service as any).recoverPendingQiBroadcasts()
    await Promise.resolve()

    expect(restartedService.db.addOrUpdateQiTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: TX_HASH,
        status: TransactionStatus.PENDING,
      })
    )
    expect(restartedService.monitor).toHaveBeenCalledTimes(1)
  })
})
