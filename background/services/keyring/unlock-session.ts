import { UNIXTime } from "../../types"
import { SerializedSaltedKey } from "./utils/encryption"

export const UNLOCK_SESSION_STORAGE_KEY = "pelagusUnlockSession"

export type KeyringUnlockSession = {
  version: 1
  saltedKey: SerializedSaltedKey
  lastInternalWalletActivity: UNIXTime
  lastExternalWalletActivity: UNIXTime
}

type SessionStorageArea = Pick<
  chrome.storage.StorageArea,
  "get" | "remove" | "set" | "setAccessLevel"
>

function isSerializedSaltedKey(value: unknown): value is SerializedSaltedKey {
  if (typeof value !== "object" || value === null) return false

  const candidate = value as Partial<SerializedSaltedKey>
  return (
    typeof candidate.salt === "string" &&
    typeof candidate.keyMaterial === "string"
  )
}

export function isKeyringUnlockSession(
  value: unknown
): value is KeyringUnlockSession {
  if (typeof value !== "object" || value === null) return false

  const candidate = value as Partial<KeyringUnlockSession>
  return (
    candidate.version === 1 &&
    isSerializedSaltedKey(candidate.saltedKey) &&
    typeof candidate.lastInternalWalletActivity === "number" &&
    Number.isFinite(candidate.lastInternalWalletActivity) &&
    typeof candidate.lastExternalWalletActivity === "number" &&
    Number.isFinite(candidate.lastExternalWalletActivity)
  )
}

/**
 * Serializes writes so a delayed activity update can never recreate a session
 * after the user has locked the wallet.
 */
export class UnlockSessionStore {
  private pendingOperation: Promise<void> = Promise.resolve()

  constructor(private readonly storage: SessionStorageArea) {}

  public async initialize(): Promise<void> {
    await this.storage.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  }

  public async get(): Promise<KeyringUnlockSession | null> {
    await this.pendingOperation.catch(() => undefined)

    const stored = await this.storage.get(UNLOCK_SESSION_STORAGE_KEY)
    const session = stored[UNLOCK_SESSION_STORAGE_KEY]

    if (session === undefined) return null
    if (isKeyringUnlockSession(session)) return session

    await this.clear()
    return null
  }

  public set(session: KeyringUnlockSession): Promise<void> {
    return this.enqueue(() =>
      this.storage.set({ [UNLOCK_SESSION_STORAGE_KEY]: session })
    )
  }

  public clear(): Promise<void> {
    return this.enqueue(() => this.storage.remove(UNLOCK_SESSION_STORAGE_KEY))
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    this.pendingOperation = this.pendingOperation
      .catch(() => undefined)
      .then(operation)
    return this.pendingOperation
  }
}
