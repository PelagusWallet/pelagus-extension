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
  shouldReloadHandler: () => Promise<void>
}

describe("KeyringService lock ordering", () => {
  it("invalidates key material before waiting for UI updates", async () => {
    const keyringService = await KeyringService.create()
    const internals = keyringService as unknown as KeyringServiceInternals
    let unlocked = true
    let finishNotify: () => void = () => undefined

    jest
      .spyOn(keyringService.vaultManager, "isSaltedKeyInitialized")
      .mockImplementation(() => unlocked)
    jest.spyOn(internals.walletManager, "clearState").mockImplementation(() => {
      unlocked = false
    })
    const notifyUI = jest
      .spyOn(keyringService, "notifyUIWithUpdates")
      .mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishNotify = resolve
          })
      )
    internals.shouldReloadHandler = jest.fn().mockResolvedValue(undefined)
    keyringService.lastInternalWalletActivity = Date.now()
    keyringService.lastExternalWalletActivity = Date.now()

    const lock = keyringService.lock()

    try {
      expect(notifyUI).toHaveBeenCalledTimes(1)
      expect(keyringService.isLocked()).toBe(true)
      expect(keyringService.lastInternalWalletActivity).toBeNull()
      expect(keyringService.lastExternalWalletActivity).toBeNull()
      await expect(keyringService.getQiHDWallet()).rejects.toThrow(
        "KeyringService must be unlocked"
      )
    } finally {
      finishNotify()
      await lock
    }
  })
})
