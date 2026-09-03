import KeyringService from ".."

jest.mock("../../../index", () => ({
  browser: {
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(undefined),
      },
    },
  },
}))

type KeyringServiceInternals = {
  walletManager: {
    clearState: () => void
  }
  clearLegacyUnlockSession: () => Promise<void>
  shouldReloadHandler: () => Promise<void>
}

describe("KeyringService lock ordering", () => {
  it("invalidates key material before waiting for legacy session cleanup", async () => {
    const keyringService = await KeyringService.create()
    const internals = keyringService as unknown as KeyringServiceInternals
    let unlocked = true
    let finishClear: () => void = () => undefined

    jest
      .spyOn(keyringService.vaultManager, "isSaltedKeyInitialized")
      .mockImplementation(() => unlocked)
    jest.spyOn(internals.walletManager, "clearState").mockImplementation(() => {
      unlocked = false
    })
    const clearSession = jest
      .spyOn(internals, "clearLegacyUnlockSession")
      .mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishClear = resolve
          })
      )
    jest.spyOn(keyringService, "notifyUIWithUpdates").mockResolvedValue()
    internals.shouldReloadHandler = jest.fn().mockResolvedValue(undefined)
    keyringService.lastInternalWalletActivity = Date.now()
    keyringService.lastExternalWalletActivity = Date.now()

    const lock = keyringService.lock()

    try {
      expect(clearSession).toHaveBeenCalledTimes(1)
      expect(keyringService.isLocked()).toBe(true)
      await expect(keyringService.getQiHDWallet()).rejects.toThrow(
        "KeyringService must be unlocked"
      )
    } finally {
      finishClear()
      await lock
    }
  })
})
