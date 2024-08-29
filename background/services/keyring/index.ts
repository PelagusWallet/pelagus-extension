import logger from "../../lib/logger"
import { ServiceCreatorFunction } from "../types"
import {
  Events,
  InternalSignerWithType,
  KeyringAccountSigner,
  SignerImportMetadata,
  SignerImportSource,
} from "./types"
import { getEncryptedVaults } from "./storage"
import BaseService from "../base"
import { IVaultManager, VaultManager } from "./vault-manager"
import { UNIXTime } from "../../types"
import { MINUTE } from "../../constants"
import { customError, isSignerPrivateKeyType } from "./utils"
import { SignerType } from "../signing"
import WalletManager from "./wallet-manager"

export const MAX_KEYRING_IDLE_TIME = 10 * MINUTE
export const MAX_OUTSIDE_IDLE_TIME = 10 * MINUTE

export default class KeyringService extends BaseService<Events> {
  private walletManager: WalletManager

  private readonly vaultManager: IVaultManager

  public lastInternalWalletActivity: UNIXTime | null

  public lastExternalWalletActivity: UNIXTime | null

  static create: ServiceCreatorFunction<Events, KeyringService, []> =
    async () => new this()

  private constructor() {
    super({
      autolock: {
        schedule: {
          periodInMinutes: 1,
        },
        handler: () => {
          this.autoLockKeyring()
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
    const isLocked = !this.vaultManager.isSymmetricKeyInitialized()
    await this.emitter.emit("locked", isLocked)
  }

  override async internalStopService(): Promise<void> {
    await this.lockKeyring()
    await super.internalStopService()
  }

  public isLockedKeyring(): boolean {
    return !this.vaultManager.isSymmetricKeyInitialized()
  }

  public async lockKeyring(): Promise<void> {
    this.walletManager.clearState()
    this.lastExternalWalletActivity = null
    this.lastInternalWalletActivity = null

    await this.notifyUIWithKeyringUpdates()
  }

  public async unlockKeyring(password: string): Promise<boolean> {
    try {
      await this.vaultManager.initializeWithPassword(password)
      await this.walletManager.initState()

      this.lastInternalWalletActivity = Date.now()
      this.lastExternalWalletActivity = Date.now()

      await this.notifyUIWithKeyringUpdates()
      return true
    } catch (error) {
      logger.error("Error while unlocking keyring service", error)
      return false
    }
  }

  private autoLockKeyring(): void {
    if (!this.lastInternalWalletActivity || !this.lastExternalWalletActivity) {
      this.notifyUIWithKeyringUpdates().then(() =>
        this.walletManager.clearState()
      )
      return
    }

    const now = Date.now()
    const timeSinceLastKeyringActivity = now - this.lastInternalWalletActivity
    const timeSinceLastOutsideActivity = now - this.lastExternalWalletActivity

    if (
      timeSinceLastKeyringActivity >= MAX_KEYRING_IDLE_TIME ||
      timeSinceLastOutsideActivity >= MAX_OUTSIDE_IDLE_TIME
    ) {
      this.notifyUIWithKeyringUpdates().then(() =>
        this.walletManager.clearState()
      )
    }
  }

  private requireUnlockKeyring(): void {
    if (this.isLockedKeyring()) {
      throw new Error("KeyringService must be unlocked.")
    }

    this.lastInternalWalletActivity = Date.now()
    this.lastExternalWalletActivity = Date.now()
  }

  public markOutsideActivity(): void {
    if (typeof this.lastExternalWalletActivity !== "undefined") {
      this.lastExternalWalletActivity = Date.now()
    }
  }

  public async notifyUIWithKeyringUpdates(): Promise<void> {
    const isLocked = this.isLockedKeyring()
    if (isLocked) {
      await this.emitter.emit("locked", true)
      await this.emitter.emit("keyrings", {
        privateKeys: [],
        keyrings: [],
        keyringMetadata: {},
      })

      return
    }

    const { wallets, quaiHDWallets, keyringMetadata } =
      this.walletManager.getState()

    await this.emitter.emit("locked", false)
    await this.emitter.emit("keyrings", {
      privateKeys: wallets,
      keyrings: quaiHDWallets,
      keyringMetadata: { ...keyringMetadata },
    })
  }

  // -------------------------- public methods --------------------------
  public async importKeyring(
    signerMetadata: SignerImportMetadata
  ): Promise<{ address: string | null; errorMessage: string }> {
    this.requireUnlockKeyring()

    try {
      const address = await this.walletManager.import(signerMetadata)

      await this.emitter.emit("address", address)
      await this.notifyUIWithKeyringUpdates()

      return { address, errorMessage: "" }
    } catch (error: any) {
      logger.error("Signer import failed:", error)

      return error?.cause === customError
        ? { address: null, errorMessage: error?.message }
        : {
            address: null,
            errorMessage: "Unexpected error during signer import",
          }
    }
  }

  public async exportWalletPrivateKey(address: string): Promise<string> {
    this.requireUnlockKeyring()

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
    this.requireUnlockKeyring()

    const signerWithType = await this.walletManager.findSigner(address)
    if (!signerWithType) {
      throw new Error(`Signer for address ${address} was not found.`)
    }

    return signerWithType
  }

  public async getKeyringSourceForAddress(
    address: string
  ): Promise<SignerImportSource | null> {
    this.requireUnlockKeyring()

    return this.walletManager.getSource(address)
  }

  public async deriveAddress(
    keyringAccountSigner: KeyringAccountSigner
  ): Promise<void> {
    this.requireUnlockKeyring()

    const address = await this.walletManager.deriveQuaiHDWalletAddress(
      keyringAccountSigner
    )

    await this.emitter.emit("address", address)
    await this.notifyUIWithKeyringUpdates()
  }

  public async generateMnemonic(): Promise<{ id: string; mnemonic: string[] }> {
    this.requireUnlockKeyring()
    return this.walletManager.createQuaiHDWalletMnemonic()
  }

  public async removeKeyringAccount(
    address: string,
    signerType: SignerType
  ): Promise<void> {
    await this.walletManager.deleteAccount(address, signerType)
    await this.notifyUIWithKeyringUpdates()
  }
}
