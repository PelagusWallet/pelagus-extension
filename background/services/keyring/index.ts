import { QiHDWallet, Wallet } from "quais"
import logger from "../../lib/logger"
import { ServiceCreatorFunction } from "../types"
import { getEncryptedVaults } from "./utils/storage"
import BaseService from "../base"
import { IVaultManager, VaultManager } from "./vault-manager"
import { UNIXTime } from "../../types"
import { MINUTE } from "../../constants"
import {
  DEFAULT_AUTO_LOCK_INTERVAL_MINUTES,
  shouldAutoLock,
} from "../../constants/auto-lock"
import { SignerType } from "../signing"
import WalletManager from "./wallet-manager"
import { applicationError } from "../../constants/errorsCause"
import { KeyringServiceEvents } from "./events"
import {
  InternalSignerWithType,
  KeyringAccountSigner,
  SignerImportMetadata,
  SignerImportSource,
} from "./types"
import { isSignerPrivateKeyType } from "./utils"
import { browser } from "../../index"
import { KeyringUnlockSession, UnlockSessionStore } from "./unlock-session"
import { SerializedSaltedKey } from "./utils/encryption"

/*
 * KeyringService is responsible for all key material, as well as applying the
 * material to sign messages, and derive child keypair.
 *
 * The service can be in two states, locked or unlocked, and starts up locked.
 * Keyrings are persisted in encrypted form when the service is locked.
 *
 * When unlocked, the service automatically locks itself after it has not seen
 * activity for a certain amount of time. The service can be notified of
 * outside activity that should be considered for the purposes of keeping the
 * service unlocked. The auto-lock interval is measured from the most recent
 * keyring or outside activity.
 */
export default class KeyringService extends BaseService<KeyringServiceEvents> {
  private walletManager: WalletManager

  public readonly vaultManager: IVaultManager

  public lastInternalWalletActivity: UNIXTime | null = null

  public lastExternalWalletActivity: UNIXTime | null = null

  private readonly unlockSessionStore: UnlockSessionStore

  private serializedSaltedKey: SerializedSaltedKey | null = null

  static create: ServiceCreatorFunction<
    KeyringServiceEvents,
    KeyringService,
    []
  > = async () => new this()

  private constructor() {
    super({
      autolock: {
        schedule: {
          periodInMinutes: 1,
        },
        handler: () => {
          this.serviceAutoLockHandler()
        },
      },
      autoReload: {
        schedule: {
          periodInMinutes: 720,
        },
        handler: () => this.dailyReload(),
        runAtStart: false,
      },
    })

    this.vaultManager = new VaultManager()
    this.walletManager = new WalletManager(this.vaultManager)
    this.unlockSessionStore = new UnlockSessionStore(chrome.storage.session)
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()

    try {
      await this.unlockSessionStore.initialize()
    } catch (error) {
      logger.error("Unable to initialize unlock session storage", error)
    }

    // Don't emit if there are no quaiHDWallets to unlock
    const { vaults } = await getEncryptedVaults()
    if (!vaults.length) {
      await this.clearUnlockSession()
      return
    }

    if (await this.restoreUnlockSession()) return

    // Emit locked status on startup. Should always be locked, but the main
    // goal is to have external viewers synced to internal state no matter what it is.
    const isLocked = !this.vaultManager.isSaltedKeyInitialized()
    await this.emitter.emit("locked", isLocked)
  }

  override async internalStopService(): Promise<void> {
    await this.lock()
    await super.internalStopService()
  }

  /**
   * @returns {Promise<boolean>} - True if keyring service is locked; false if keyring service is unlocked.
   */
  public isLocked(): boolean {
    return !this.vaultManager.isSaltedKeyInitialized()
  }

  public async lock(): Promise<void> {
    await this.clearUnlockSession()
    this.walletManager.clearState()
    this.serializedSaltedKey = null
    this.lastExternalWalletActivity = null
    this.lastInternalWalletActivity = null

    await this.notifyUIWithUpdates()

    await this.shouldReloadHandler()
  }

  public async unlock(password: string): Promise<boolean> {
    try {
      const unlockStart = performance.now()

      const keyDerivationStart = performance.now()
      this.serializedSaltedKey = await this.vaultManager.initializeWithPassword(
        password
      )
      const keyDerivationEnd = performance.now()
      console.log(
        `[Unlock] Key derivation took ${(
          keyDerivationEnd - keyDerivationStart
        ).toFixed(0)}ms`
      )

      const initStateStart = performance.now()
      await this.walletManager.initializeState()
      const initStateEnd = performance.now()
      console.log(
        `[Unlock] Wallet state initialization took ${(
          initStateEnd - initStateStart
        ).toFixed(0)}ms`
      )

      this.lastInternalWalletActivity = Date.now()
      this.lastExternalWalletActivity = Date.now()
      try {
        await this.persistUnlockSession()
      } catch (error) {
        logger.error("Unable to persist the unlocked keyring session", error)
      }

      const notifyStart = performance.now()
      await this.notifyUIWithUpdates()
      const notifyEnd = performance.now()
      console.log(
        `[Unlock] UI notification took ${(notifyEnd - notifyStart).toFixed(
          0
        )}ms`
      )

      const unlockEnd = performance.now()
      console.log(
        `[Unlock] Total unlock time: ${(unlockEnd - unlockStart).toFixed(0)}ms`
      )

      return true
    } catch (error) {
      logger.error("Error while unlocking keyring service", error)
      this.vaultManager.clearSaltedKey()
      this.serializedSaltedKey = null
      await this.clearUnlockSession()
      return false
    }
  }

  public async confirmPassword(password: string): Promise<boolean> {
    this.verifyKeyringIsUnlocked()
    return this.vaultManager.verifyPassword(password)
  }

  /**
   * Restarts the wallet extension background worker.
   * This function is triggered every 12 hours.
   */
  private async dailyReload() {
    if (this.isLocked()) {
      chrome.runtime.reload()
      return
    }

    await browser.storage.local.set({ shouldReload: true })
  }

  private async shouldReloadHandler() {
    const { shouldReload } = await browser.storage.local.get("shouldReload")

    if (!shouldReload) return

    await browser.storage.local.set({ shouldReload: false })
    chrome.runtime.reload()
  }

  private getAutoLockInterval(): number {
    const state = globalThis.main.store.getState()
    return (
      (state.ui.settings.autoLockInterval ||
        DEFAULT_AUTO_LOCK_INTERVAL_MINUTES) * MINUTE
    )
  }

  // Locks the keyring when neither keyring nor outside activity has occurred
  // during the configured interval.
  private serviceAutoLockHandler(): void {
    if (this.isLocked()) {
      this.shouldReloadHandler().catch((error) => {
        logger.error("Error while handling shouldReload flag", error)
      })
      return
    }

    const now = Date.now()
    const autoLockInterval = this.getAutoLockInterval()

    if (
      shouldAutoLock(
        now,
        this.lastInternalWalletActivity,
        this.lastExternalWalletActivity,
        autoLockInterval
      )
    ) {
      this.lock().catch((error) => {
        logger.error("Error while autolocking keyring", error)
      })
    }
  }

  private verifyKeyringIsUnlocked(): void {
    if (this.isLocked()) {
      throw new Error("KeyringService must be unlocked")
    }

    this.lastInternalWalletActivity = Date.now()
    this.lastExternalWalletActivity = Date.now()
    this.persistUnlockSession().catch((error) => {
      logger.error("Unable to persist keyring activity", error)
    })
  }

  /**
   * Notifies the keyring that an outside activity occurred. Outside activities
   * are used to delay auto locking.
   */
  public markOutsideActivity(): void {
    if (!this.isLocked()) {
      this.lastExternalWalletActivity = Date.now()
      this.persistUnlockSession().catch((error) => {
        logger.error("Unable to persist outside wallet activity", error)
      })
    }
  }

  private async restoreUnlockSession(): Promise<boolean> {
    try {
      const session = await this.unlockSessionStore.get()
      if (!session) return false

      if (
        shouldAutoLock(
          Date.now(),
          session.lastInternalWalletActivity,
          session.lastExternalWalletActivity,
          this.getAutoLockInterval()
        )
      ) {
        await this.clearUnlockSession()
        return false
      }

      await this.vaultManager.initializeWithSerializedKey(session.saltedKey)
      await this.walletManager.initializeState()

      this.serializedSaltedKey = session.saltedKey
      this.lastInternalWalletActivity = session.lastInternalWalletActivity
      this.lastExternalWalletActivity = session.lastExternalWalletActivity
      await this.notifyUIWithUpdates()
      return true
    } catch (error) {
      logger.error("Unable to restore the unlocked keyring session", error)
      this.walletManager.clearState()
      this.serializedSaltedKey = null
      this.lastInternalWalletActivity = null
      this.lastExternalWalletActivity = null
      await this.clearUnlockSession()
      return false
    }
  }

  private async persistUnlockSession(): Promise<void> {
    if (
      !this.serializedSaltedKey ||
      this.lastInternalWalletActivity === null ||
      this.lastExternalWalletActivity === null
    ) {
      return
    }

    const session: KeyringUnlockSession = {
      version: 1,
      saltedKey: this.serializedSaltedKey,
      lastInternalWalletActivity: this.lastInternalWalletActivity,
      lastExternalWalletActivity: this.lastExternalWalletActivity,
    }
    await this.unlockSessionStore.set(session)
  }

  private async clearUnlockSession(): Promise<void> {
    try {
      await this.unlockSessionStore.clear()
    } catch (error) {
      logger.error("Unable to clear unlock session storage", error)
    }
  }

  public async notifyUIWithUpdates(): Promise<void> {
    const isLocked = this.isLocked()
    if (isLocked) {
      await this.emitter.emit("locked", true)
      await this.emitter.emit("keyrings", {
        privateKeys: [],
        qiHDWallet: null,
        keyrings: [],
        keyringMetadata: {},
      })

      return
    }

    const { wallets, qiHDWallet, quaiHDWallets, keyringMetadata } =
      this.walletManager.getState()

    await this.emitter.emit("locked", false)
    await this.emitter.emit("keyrings", {
      privateKeys: wallets,
      qiHDWallet,
      keyrings: quaiHDWallets,
      keyringMetadata: { ...keyringMetadata },
    })
    await this.emitter.emit("loadQiWallet", qiHDWallet)
  }

  // -------------------------- public methods --------------------------
  public async importKeyring(
    signerMetadata: SignerImportMetadata
  ): Promise<{ address: string | null; errorMessage: string }> {
    this.verifyKeyringIsUnlocked()

    try {
      const address = await this.walletManager.importSigner(signerMetadata)

      await this.emitter.emit("address", address)
      await this.notifyUIWithUpdates()

      return { address, errorMessage: "" }
    } catch (error: any) {
      logger.error("Signer import failed:", error)

      return {
        address: null,
        errorMessage:
          error?.cause === applicationError
            ? error?.message
            : "Unexpected error during signer import",
      }
    }
  }

  public async importQiPrivateKey(
    privateKey: string
  ): Promise<{ errorMessage: string }> {
    try {
      this.verifyKeyringIsUnlocked()
      await this.walletManager.importQiPrivateKey(privateKey)

      return { errorMessage: "" }
    } catch (error: any) {
      logger.error("Qi private key import failed:", error)

      return {
        errorMessage:
          error?.cause === applicationError
            ? error?.message
            : "Unexpected error during signer import",
      }
    }
  }

  public async exportWalletPrivateKey(
    password: string,
    address: string
  ): Promise<string> {
    await this.requirePasswordConfirmation(password)

    const signerWithType = await this.walletManager.findSigner(address)
    if (!signerWithType) {
      const error = new Error(`Signer not found for address ${address}`)
      logger.error("Export private key failed:", error)
      throw error
    }

    if (isSignerPrivateKeyType(signerWithType)) {
      return signerWithType.signer.privateKey
    }

    try {
      const privateKey = signerWithType.signer.getPrivateKey(
        signerWithType.address
      )

      if (!privateKey) {
        throw new Error(
          `No private key returned for address ${signerWithType.address}`
        )
      }

      return privateKey
    } catch (error) {
      logger.error(
        `Export private key derivation failed for ${signerWithType.address}:`,
        error
      )
      throw error
    }
  }

  public async exportWalletPrivateKeyEncryptedJSON(
    walletPassword: string,
    password: string,
    address: string
  ): Promise<string> {
    await this.requirePasswordConfirmation(walletPassword)

    const signerWithType = await this.walletManager.findSigner(address)
    if (!signerWithType) {
      const error = new Error(`Signer not found for address ${address}`)
      logger.error("Export encrypted private key failed:", error)
      throw error
    }

    if (isSignerPrivateKeyType(signerWithType)) {
      const jsonKeystore = await signerWithType.signer.encrypt(password)
      return jsonKeystore
    }

    try {
      const privateKey = signerWithType.signer.getPrivateKey(
        signerWithType.address
      )

      if (!privateKey) {
        throw new Error(
          `No private key returned for address ${signerWithType.address}`
        )
      }

      const jsonKeystore = await new Wallet(privateKey).encrypt(password)
      return jsonKeystore
    } catch (error) {
      logger.error(
        `Export encrypted private key derivation failed for ${signerWithType.address}:`,
        error
      )
      throw error
    }
  }

  public async exportQiCoinbaseAddress(
    password: string,
    address: string
  ): Promise<string> {
    await this.requirePasswordConfirmation(password)

    const qiHDWallet = await this.walletManager.getQiHDWallet()
    if (qiHDWallet) {
      try {
        return qiHDWallet.getPrivateKey(address)
      } catch (error) {
        logger.error(`Export Qi private key failed for ${address}:`, error)
        throw error
      }
    }

    const error = new Error("Qi HD wallet not found")
    logger.error("Export Qi private key failed:", error)
    throw error
  }

  private async requirePasswordConfirmation(password: string): Promise<void> {
    this.verifyKeyringIsUnlocked()

    if (!(await this.vaultManager.verifyPassword(password))) {
      throw new Error("Invalid password")
    }
  }

  public async signMessageWithAllQiAddresses(
    message: string | Uint8Array
  ): Promise<string> {
    this.verifyKeyringIsUnlocked()
    try {
      const { jsonRpcProvider } = globalThis.main.chainService

      const qiHDWallet = await this.walletManager.getQiHDWallet()
      if (qiHDWallet) {
        const serializedWallet = qiHDWallet.serialize()
        const uniqueAddresses = Array.from(
          new Set(serializedWallet.addresses.map((address) => address.address))
        )

        const addressesToSignFor: string[] = []

        // check balance of each address and only keep one with balance
        await Promise.all(
          uniqueAddresses.map(async (address) => {
            const balance = await jsonRpcProvider.getBalance(address)
            if (balance > 0n) {
              addressesToSignFor.push(address)
            }
          })
        )

        const privateKeys = addressesToSignFor.map((address) =>
          qiHDWallet.getPrivateKey(address)
        )

        const signedMessages = await Promise.all(
          privateKeys.map((privateKey) =>
            new Wallet(privateKey).signMessage(message)
          )
        )

        return signedMessages.join(",")
      }
    } catch (error: any) {
      logger.error(
        "Error signing message with all Qi addresses",
        error?.message || error
      )
    }
    return ""
  }

  public async getSigner(address: string): Promise<InternalSignerWithType> {
    this.verifyKeyringIsUnlocked()

    const signerWithType = await this.walletManager.findSigner(address)
    if (!signerWithType) {
      throw new Error(`Signer for address ${address} was not found.`)
    }

    return signerWithType
  }

  public async getKeyringSourceForAddress(
    address: string
  ): Promise<SignerImportSource | null> {
    this.verifyKeyringIsUnlocked()

    return this.walletManager.getSignerSource(address)
  }

  public async getQiHDWallet(): Promise<QiHDWallet> {
    return this.walletManager.getQiHDWallet()
  }

  public async deriveKeyringAddress(
    keyringAccountSigner: KeyringAccountSigner
  ): Promise<void> {
    this.verifyKeyringIsUnlocked()

    const address = await this.walletManager.deriveQuaiHDWalletAddress(
      keyringAccountSigner
    )

    await this.emitter.emit("address", address)
    await this.notifyUIWithUpdates()
  }

  public async generateMnemonic(): Promise<{ id: string; mnemonic: string[] }> {
    this.verifyKeyringIsUnlocked()
    return this.walletManager.generateQuaiHDWalletMnemonic()
  }

  public async removeKeyring(
    address: string,
    signerType: SignerType
  ): Promise<void> {
    await this.walletManager.deleteSigner(address, signerType)
    await this.notifyUIWithUpdates()
  }
}
