import browser from "webextension-polyfill"
import { EncryptedVault } from "./encryption"
import { UNIXTime } from "../../../types"

type SerializedEncryptedVault = {
  timeSaved: UNIXTime
  vault: EncryptedVault
}

type SerializedEncryptedVaults = {
  version: 1
  vaults: SerializedEncryptedVault[]
}

/**
 * Retrieve all serialized encrypted vaults from extension storage.
 *
 * @returns a schema version and array of serialized vaults
 */
export async function getEncryptedVaults(): Promise<SerializedEncryptedVaults> {
  const start = performance.now()
  const data = await browser.storage.local.get("tallyVaults")
  const readTime = performance.now() - start

  if (!("tallyVaults" in data)) {
    console.log(`[Storage] No vaults found, read took ${readTime.toFixed(0)}ms`)
    return {
      version: 1,
      vaults: [],
    }
  }
  const { tallyVaults } = data

  // Log vault size for diagnostics
  const vaultJson = JSON.stringify(tallyVaults)
  const sizeKB = (vaultJson.length / 1024).toFixed(1)
  const sizeMB = (vaultJson.length / 1024 / 1024).toFixed(2)
  console.log(`[Storage] Vault read took ${readTime.toFixed(0)}ms, size: ${sizeKB}KB (${sizeMB}MB), vaults count: ${tallyVaults?.vaults?.length || 0}`)
  if (
    "version" in tallyVaults &&
    tallyVaults.version === 1 &&
    "vaults" in tallyVaults &&
    Array.isArray(tallyVaults.vaults)
  ) {
    return tallyVaults as SerializedEncryptedVaults
  }
  throw new Error("Encrypted vaults are using an unknown serialization format")
}

function equalVaults(vault1: EncryptedVault, vault2: EncryptedVault): boolean {
  if (vault1.salt !== vault2.salt) {
    return false
  }
  if (vault1.initializationVector !== vault2.initializationVector) {
    return false
  }
  if (vault1.cipherText !== vault2.cipherText) {
    return false
  }
  return true
}

/**
 * Write an encryptedVault to extension storage if and only if it's different
 * than the most recently saved vault.
 *
 * @param encryptedVault - an encrypted keyring vault
 */
// Maximum number of vault snapshots to keep (for backup/recovery purposes)
const MAX_VAULT_HISTORY = 3

export async function writeLatestEncryptedVault(
  encryptedVault: EncryptedVault
): Promise<void> {
  const serializedVaults = await getEncryptedVaults()
  const vaults = [...serializedVaults.vaults]
  const currentLatest = vaults.reduce<SerializedEncryptedVault | null>(
    (newestVault, nextVault) =>
      newestVault && newestVault.timeSaved > nextVault.timeSaved
        ? newestVault
        : nextVault,
    null
  )
  const oldVault = currentLatest && currentLatest.vault
  // if there's been a change, persist the vault
  if (!oldVault || !equalVaults(oldVault, encryptedVault)) {
    // Sort by timeSaved descending and keep only the most recent MAX_VAULT_HISTORY - 1 vaults
    // (leaving room for the new one)
    const sortedVaults = [...serializedVaults.vaults].sort(
      (a, b) => b.timeSaved - a.timeSaved
    )
    const vaultsToKeep = sortedVaults.slice(0, MAX_VAULT_HISTORY - 1)

    const newVaults = [
      ...vaultsToKeep,
      {
        timeSaved: Date.now(),
        vault: encryptedVault,
      },
    ]

    await browser.storage.local.set({
      tallyVaults: {
        ...serializedVaults,
        vaults: newVaults,
      },
    })
  }
}
