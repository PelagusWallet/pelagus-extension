import KeyringService from ".."
import WalletManager from "../wallet-manager"
import { SignerImportSource } from "../types"
import { browser } from "../../../index"
import logger from "../../../lib/logger"
import { MINUTE, SECOND } from "../../../constants"

jest.mock("../../../index", () => ({
  browser: {
    runtime: { getPlatformInfo: jest.fn().mockResolvedValue({}) },
    storage: { local: { get: jest.fn().mockResolvedValue({}) } },
  },
}))

type KeyringInternals = {
  walletManager: WalletManager
  serviceAutoLockHandler: () => void
}

describe("KeyringService worker heartbeat", () => {
  const originalMain = globalThis.main
  let service: KeyringService
  let internals: KeyringInternals

  beforeEach(async () => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    globalThis.main = {
      store: {
        getState: () => ({ ui: { settings: { autoLockInterval: 1440 } } }),
      },
    } as unknown as typeof globalThis.main
    service = await KeyringService.create()
    internals = service as unknown as KeyringInternals
    let unlocked = false
    jest
      .spyOn(service.vaultManager, "initializeWithPassword")
      .mockImplementation(async () => {
        unlocked = true
      })
    jest
      .spyOn(service.vaultManager, "isSaltedKeyInitialized")
      .mockImplementation(() => unlocked)
    jest
      .spyOn(service.vaultManager, "clearSaltedKey")
      .mockImplementation(() => {
        unlocked = false
      })
    jest
      .spyOn(internals.walletManager, "initializeState")
      .mockResolvedValue(undefined)
    jest.spyOn(service, "notifyUIWithUpdates").mockResolvedValue(undefined)
    jest.spyOn(logger, "error").mockImplementation(() => undefined)
  })

  afterEach(async () => {
    await service.lock()
    jest.restoreAllMocks()
    jest.useRealTimers()
    globalThis.main = originalMain
  })

  it("runs only while unlocked and does not duplicate on another unlock", async () => {
    jest.advanceTimersByTime(MINUTE)
    expect(browser.runtime.getPlatformInfo).not.toHaveBeenCalled()

    await expect(service.unlock("test password")).resolves.toBe(true)
    await expect(service.unlock("test password")).resolves.toBe(true)
    jest.advanceTimersByTime(20 * SECOND)
    expect(browser.runtime.getPlatformInfo).toHaveBeenCalledTimes(1)

    await service.lock()
    jest.advanceTimersByTime(MINUTE)
    expect(browser.runtime.getPlatformInfo).toHaveBeenCalledTimes(1)
  })

  it("does not count heartbeats as activity or extend the one-day lock deadline", async () => {
    await service.unlock("test password")
    const unlockedAt = Date.now()
    jest.advanceTimersByTime(10 * MINUTE)
    expect(browser.runtime.getPlatformInfo).toHaveBeenCalledTimes(30)
    expect(service.lastInternalWalletActivity).toBe(unlockedAt)
    expect(service.lastExternalWalletActivity).toBe(unlockedAt)

    jest.setSystemTime(unlockedAt + 1440 * MINUTE - 1)
    internals.serviceAutoLockHandler()
    expect(service.isLocked()).toBe(false)
    jest.setSystemTime(unlockedAt + 1440 * MINUTE)
    internals.serviceAutoLockHandler()
    expect(service.isLocked()).toBe(true)
    jest.advanceTimersByTime(MINUTE)
    expect(browser.runtime.getPlatformInfo).toHaveBeenCalledTimes(30)
  })

  it.each(["password", "wallet initialization", "UI notification"])(
    "clears unlock state and stops the heartbeat when unlocking fails during %s",
    async (failure) => {
      await service.unlock("test password")
      internals.walletManager.keyringMetadata = {
        wallet: { source: SignerImportSource.import },
      }
      internals.walletManager.hiddenAccounts = { "0x1234": true }
      const error = new Error("Unlock failed")
      if (failure === "password") {
        jest
          .spyOn(service.vaultManager, "initializeWithPassword")
          .mockRejectedValueOnce(error)
      } else if (failure === "wallet initialization") {
        jest
          .spyOn(internals.walletManager, "initializeState")
          .mockRejectedValueOnce(error)
      } else {
        jest.spyOn(service, "notifyUIWithUpdates").mockRejectedValueOnce(error)
      }

      await expect(service.unlock("test password")).resolves.toBe(false)
      jest.advanceTimersByTime(MINUTE)
      expect(service.isLocked()).toBe(true)
      expect(internals.walletManager.getState()).toEqual({
        wallets: [],
        qiHDWallet: null,
        quaiHDWallets: [],
        keyringMetadata: {},
      })
      expect(internals.walletManager.hiddenAccounts).toEqual({})
      expect(service.lastInternalWalletActivity).toBeNull()
      expect(service.lastExternalWalletActivity).toBeNull()
      expect(browser.runtime.getPlatformInfo).not.toHaveBeenCalled()
    }
  )

  it("logs an API rejection and continues the heartbeat", async () => {
    const error = new Error("Runtime unavailable")
    jest.mocked(browser.runtime.getPlatformInfo).mockRejectedValueOnce(error)
    await service.unlock("test password")
    jest.advanceTimersByTime(40 * SECOND)
    await Promise.resolve()

    expect(logger.error).toHaveBeenCalledWith(
      "Error while keeping the unlocked keyring alive",
      error
    )
    expect(service.isLocked()).toBe(false)
    expect(browser.runtime.getPlatformInfo).toHaveBeenCalledTimes(2)
  })
})
