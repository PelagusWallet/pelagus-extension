import { WalletManager } from "./wallet-manager"
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
import { isSignerPrivateKeyType } from "./utils"
import { SignerType } from "../signing"

export const MAX_KEYRING_IDLE_TIME = 10 * MINUTE
export const MAX_OUTSIDE_IDLE_TIME = 10 * MINUTE

export default class KeyringService extends BaseService<Events> {
  private walletManager

  private vaultManager: IVaultManager

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
    const isLocked = this.vaultManager.isSymmetricKeyInitialized()
    await this.emitter.emit("locked", isLocked)
  }

  override async internalStopService(): Promise<void> {
    await this.lockKeyring()
    await super.internalStopService()
  }

  isLockedKeyring(): boolean {
    return this.vaultManager.isSymmetricKeyInitialized()
  }

  async lockKeyring(): Promise<void> {
    this.walletManager.clearState()
    this.lastExternalWalletActivity = null
    this.lastInternalWalletActivity = null

    await this.emitter.emit("locked", true)
    await this.notifyUIWithKeyringUpdates()
  }

  async unlockKeyring(password: string): Promise<boolean> {
    try {
      await this.walletManager.init(password)
      this.lastInternalWalletActivity = Date.now()
      this.lastExternalWalletActivity = Date.now()

      await this.notifyUIWithKeyringUpdates()

      return true
    } catch (error) {
      console.error(error)
      logger.error("Error while unlocking keyring service")
      return false
    }
  }

  private autoLockKeyring(): void {
    if (!this.lastInternalWalletActivity || !this.lastExternalWalletActivity) {
      this.walletManager.clearState()
      return
    }

    const now = Date.now()
    const timeSinceLastKeyringActivity = now - this.lastInternalWalletActivity
    const timeSinceLastOutsideActivity = now - this.lastExternalWalletActivity

    if (
      timeSinceLastKeyringActivity >= MAX_KEYRING_IDLE_TIME ||
      timeSinceLastOutsideActivity >= MAX_OUTSIDE_IDLE_TIME
    ) {
      this.walletManager.clearState()
    }
  }

  private requireUnlockKeyring(): void {
    if (this.isLockedKeyring()) {
      throw new Error("KeyringService must be unlocked.")
    }

    this.lastInternalWalletActivity = Date.now()
    this.lastExternalWalletActivity = Date.now()
  }

  async notifyUIWithKeyringUpdates(): Promise<void> {
    const isLocked = this.isLockedKeyring()

    if (isLocked) {
      await this.emitter.emit("keyrings", {
        privateKeys: [],
        keyrings: [],
        keyringMetadata: {},
      })
      return
    }

    const { wallets, quaiHDWallets, keyringMetadata } =
      this.walletManager.getStateData()

    await this.emitter.emit("keyrings", {
      privateKeys: wallets,
      keyrings: quaiHDWallets,
      keyringMetadata: { ...keyringMetadata },
    })
  }

  async importKeyring(signerMetadata: SignerImportMetadata): Promise<string> {
    this.requireUnlockKeyring()

    try {
      const address = await this.walletManager.import(signerMetadata)

      await this.emitter.emit("address", address)
      await this.notifyUIWithKeyringUpdates()

      return address
    } catch (error) {
      logger.error("Signer import failed:", error)
      return ""
    }
  }

  async exportWalletPrivateKey(address: string): Promise<string> {
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
      throw new Error(
        `Signing transaction failed. Signer for address ${address} was not found.`
      )
    }

    return signerWithType
  }

  async getKeyringSourceForAddress(
    address: string
  ): Promise<SignerImportSource | null> {
    this.requireUnlockKeyring()

    return this.walletManager.getSource(address)
  }

  async deriveAddress(
    keyringAccountSigner: KeyringAccountSigner
  ): Promise<void> {
    this.requireUnlockKeyring()

    const address = await this.walletManager.deriveQuaiHDWalletAddress(
      keyringAccountSigner
    )

    await this.emitter.emit("address", address)
    await this.notifyUIWithKeyringUpdates()
  }

  async generateMnemonic(): Promise<{ id: string; mnemonic: string[] }> {
    this.requireUnlockKeyring()
    return this.walletManager.createQuaiHDWalletMnemonic()
  }

  async removeKeyringAccount(
    address: string,
    signerType: SignerType
  ): Promise<void> {
    await this.walletManager.deleteAccount(address, signerType)
    await this.notifyUIWithKeyringUpdates()
  }

  markOutsideActivity(): void {
    if (typeof this.lastExternalWalletActivity !== "undefined") {
      this.lastExternalWalletActivity = Date.now()
    }
  }
}
