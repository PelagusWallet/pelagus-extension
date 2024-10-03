import { QiHDWallet } from "quais"
import logger from "../../lib/logger"
import { ServiceCreatorFunction } from "../types"
import { getEncryptedVaults } from "./utils/storage"
import BaseService from "../base"
import { IVaultManager, VaultManager } from "./vault-manager"
import { UNIXTime } from "../../types"
import { MINUTE } from "../../constants"
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

export const MAX_KEYRING_IDLE_TIME = 10 * MINUTE
export const MAX_OUTSIDE_IDLE_TIME = 10 * MINUTE

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
 * service unlocked. No keyring activity for 10 minutes causes the service to
 * lock, while no outside activity for 10 minutes has the same effect.
 */
export default class KeyringService extends BaseService<KeyringServiceEvents> {
  private walletManager: WalletManager

  private readonly vaultManager: IVaultManager

  public lastInternalWalletActivity: UNIXTime | null

  public lastExternalWalletActivity: UNIXTime | null

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
    })

    this.vaultManager = new VaultManager()
    this.walletManager = new WalletManager(this.vaultManager)
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()

    // Don't emit if there are no quaiHDWallets to unlock
    const { vaults } = await getEncryptedVaults()
    if (!vaults.length) return

    // Emit locked status on startup. Should always be locked, but the main
    // goal is to have external viewers synced to internal state no matter what it is.
    const isLocked = !this.vaultManager.isSaltedKeyInitialized()
    await this.emitter.emit("locked", isLocked)
  }

  override async internalStopService(): Promise<void> {
    await this.lock()
    await super.internalStopService()
  }

  public isLocked(): boolean {
    return !this.vaultManager.isSaltedKeyInitialized()
  }

  public async lock(): Promise<void> {
    this.walletManager.clearState()
    this.lastExternalWalletActivity = null
    this.lastInternalWalletActivity = null

    await this.notifyUIWithUpdates()
  }

  public async unlock(password: string): Promise<boolean> {
    try {
      await this.vaultManager.initializeWithPassword(password)
      await this.walletManager.initializeState()

      this.lastInternalWalletActivity = Date.now()
      this.lastExternalWalletActivity = Date.now()

      await this.notifyUIWithUpdates()
      return true
    } catch (error) {
      logger.error("Error while unlocking keyring service", error)
      this.vaultManager.clearSaltedKey()
      return false
    }
  }

  // Locks the keyring if the time since last keyring or outside activity exceeds preset levels.
  private serviceAutoLockHandler(): void {
    if (!this.lastInternalWalletActivity || !this.lastExternalWalletActivity) {
      this.notifyUIWithUpdates().then(() => this.walletManager.clearState())
      return
    }

    const now = Date.now()
    const timeSinceLastKeyringActivity = now - this.lastInternalWalletActivity
    const timeSinceLastOutsideActivity = now - this.lastExternalWalletActivity

    if (
      timeSinceLastKeyringActivity >= MAX_KEYRING_IDLE_TIME ||
      timeSinceLastOutsideActivity >= MAX_OUTSIDE_IDLE_TIME
    ) {
      this.notifyUIWithUpdates().then(() => this.walletManager.clearState())
    }
  }

  private verifyKeyringIsUnlocked(): void {
    if (this.isLocked()) {
      throw new Error("KeyringService must be unlocked")
    }

    this.lastInternalWalletActivity = Date.now()
    this.lastExternalWalletActivity = Date.now()
  }

  /**
   * Notifies the keyring that an outside activity occurred. Outside activities
   * are used to delay auto locking.
   */
  public markOutsideActivity(): void {
    if (typeof this.lastExternalWalletActivity !== "undefined") {
      this.lastExternalWalletActivity = Date.now()
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

  public async exportWalletPrivateKey(address: string): Promise<string> {
    this.verifyKeyringIsUnlocked()

    const signerWithType = await this.walletManager.findSigner(address)
    if (!signerWithType) {
      logger.error(`Export private key for address ${address} failed`)
      return ""
    }

    if (isSignerPrivateKeyType(signerWithType)) {
      return signerWithType.signer.privateKey
    }

    // export private key from HDWallet address
    const privateKey = signerWithType.signer.getPrivateKey(address)
    return privateKey ?? "Not found"
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
