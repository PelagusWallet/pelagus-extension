import {
  KeyringUnlockSession,
  UNLOCK_SESSION_STORAGE_KEY,
  UnlockSessionStore,
  isKeyringUnlockSession,
} from "../unlock-session"

const unlockSession: KeyringUnlockSession = {
  version: 1,
  saltedKey: {
    salt: "salt",
    keyMaterial: "key-material",
  },
  lastInternalWalletActivity: 100,
  lastExternalWalletActivity: 200,
}

function createMemoryStorage(initialValues: Record<string, unknown> = {}) {
  let values = { ...initialValues }
  const storage = {
    get: jest.fn(async () => ({ ...values })),
    set: jest.fn(async (newValues: Record<string, unknown>) => {
      values = { ...values, ...newValues }
    }),
    remove: jest.fn(async (key: string) => {
      delete values[key]
    }),
    setAccessLevel: jest.fn(async () => undefined),
  }

  return storage
}

describe(UnlockSessionStore, () => {
  it("keeps session storage limited to trusted extension contexts", async () => {
    const storage = createMemoryStorage()
    const store = new UnlockSessionStore(storage)

    await store.initialize()

    expect(storage.setAccessLevel).toHaveBeenCalledWith({
      accessLevel: "TRUSTED_CONTEXTS",
    })
  })

  it("round trips a valid unlock session", async () => {
    const storage = createMemoryStorage()
    const store = new UnlockSessionStore(storage)

    await store.set(unlockSession)

    await expect(store.get()).resolves.toEqual(unlockSession)
  })

  it("removes malformed session data", async () => {
    const storage = createMemoryStorage({
      [UNLOCK_SESSION_STORAGE_KEY]: { version: 1 },
    })
    const store = new UnlockSessionStore(storage)

    await expect(store.get()).resolves.toEqual(null)
    expect(storage.remove).toHaveBeenCalledWith(UNLOCK_SESSION_STORAGE_KEY)
  })

  it("queues a lock after an in-flight activity write", async () => {
    const storage = createMemoryStorage()
    let finishWrite: () => void = () => undefined
    storage.set.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve
        })
    )
    const store = new UnlockSessionStore(storage)

    const write = store.set(unlockSession)
    const clear = store.clear()
    await Promise.resolve()
    await Promise.resolve()

    expect(storage.set).toHaveBeenCalled()
    expect(storage.remove).not.toHaveBeenCalled()
    finishWrite()
    await write
    await clear
    expect(storage.remove).toHaveBeenCalledWith(UNLOCK_SESSION_STORAGE_KEY)
  })
})

describe(isKeyringUnlockSession, () => {
  it("rejects non-finite activity timestamps", () => {
    expect(
      isKeyringUnlockSession({
        ...unlockSession,
        lastExternalWalletActivity: Number.POSITIVE_INFINITY,
      })
    ).toEqual(false)
  })
})
