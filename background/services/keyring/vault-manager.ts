import {
  decryptVault,
  deriveSymmetricKeyFromPassword,
  EncryptedVault,
  encryptVault,
  SaltedKey,
} from "./utils/encryption"
import { AddOptions, DeleteProps, SerializedVaultData } from "./types"
import { getEncryptedVaults, writeLatestEncryptedVault } from "./utils/storage"

export interface IVaultManager {
  get(): Promise<SerializedVaultData>
  add(data: Partial<SerializedVaultData>, options: AddOptions): Promise<void>
  delete(options: DeleteProps): Promise<void>
  update(data: Partial<SerializedVaultData>): Promise<void>
  clearSaltedKey(): void
  isSaltedKeyInitialized(): boolean
  initializeWithPassword(password: string): Promise<void>
}

export class VaultManager implements IVaultManager {
  private vaultSaltedKey: SaltedKey | null = null

  // -------------------------- public methods --------------------------
  public clearSaltedKey(): void {
    this.vaultSaltedKey = null
  }

  public isSaltedKeyInitialized(): boolean {
    return this.vaultSaltedKey !== null
  }

  public async initializeWithPassword(password: string): Promise<void> {
    const { vaults } = await getEncryptedVaults()
    const currentEncryptedVault = vaults.slice(-1)[0]?.vault

    this.vaultSaltedKey = await deriveSymmetricKeyFromPassword(
      password,
      currentEncryptedVault?.salt
    )
  }

  public async get(): Promise<SerializedVaultData> {
    const saltedKey = this.getSaltedKey()
    const currentEncryptedVault = await this.getVaultData()
    return decryptVault<SerializedVaultData>(currentEncryptedVault, saltedKey)
  }

  public async add(
    data: Partial<SerializedVaultData>,
    options: AddOptions = {}
  ): Promise<void> {
    const { wallets, qiHDWallet, quaiHDWallets, metadata, hiddenAccounts } =
      await this.get()

    const mergedVaultData: SerializedVaultData = {
      wallets: options.overwriteWallets
        ? data.wallets ?? []
        : [...wallets, ...(data.wallets ?? [])],

      qiHDWallet: data.qiHDWallet ? data.qiHDWallet : qiHDWallet,

      quaiHDWallets: options.overwriteQuaiHDWallets
        ? data.quaiHDWallets ?? []
        : [...quaiHDWallets, ...(data.quaiHDWallets ?? [])],

      metadata: options.overwriteMetadata
        ? data.metadata ?? {}
        : {
            ...metadata,
            ...data.metadata,
          },

      hiddenAccounts: options.overwriteHiddenAccounts
        ? data.hiddenAccounts ?? {}
        : {
            ...hiddenAccounts,
            ...data.hiddenAccounts,
          },
    }

    await this.persistToVault(mergedVaultData)
  }

  public async delete(options: DeleteProps): Promise<void> {
    const { wallets, qiHDWallet, quaiHDWallets, metadata, hiddenAccounts } =
      await this.get()

    const filteredWallets = options.walletId
      ? wallets.filter((wallet) => wallet.id !== options.walletId)
      : wallets

    const filteredQuaiHDWallets = options.hdWalletId
      ? quaiHDWallets.filter(
          (hdWallet) => hdWallet.phrase !== options.hdWalletId
        )
      : quaiHDWallets

    const updatedMetadata = { ...metadata }
    if (options.metadataKey) delete updatedMetadata[options.metadataKey]

    const updatedHiddenAccounts = { ...hiddenAccounts }
    if (options.hiddenAccount)
      delete updatedHiddenAccounts[options.hiddenAccount]

    const mergedVaultData = {
      wallets: filteredWallets,
      qiHDWallet,
      quaiHDWallets: filteredQuaiHDWallets,
      metadata: updatedMetadata,
      hiddenAccounts: updatedHiddenAccounts,
    }
    await this.persistToVault(mergedVaultData)
  }

  public async update(data: Partial<SerializedVaultData>): Promise<void> {
    const { wallets, qiHDWallet, quaiHDWallets, metadata, hiddenAccounts } =
      await this.get()

    const updatedWallets = data.wallets
      ? wallets.map(
          (wallet) =>
            data.wallets?.find((newWallet) => newWallet.id === wallet.id) ||
            wallet
        )
      : [...wallets]

    const updatedQiHDWallet = data.qiHDWallet ? data.qiHDWallet : qiHDWallet

    const updatedQuaiHDWallets = data.quaiHDWallets
      ? quaiHDWallets.map(
          (hdWallet) =>
            data.quaiHDWallets?.find(
              (newHdWallet) => newHdWallet.phrase === hdWallet.phrase
            ) || hdWallet
        )
      : [...quaiHDWallets]

    const updatedMetadata = data.metadata
      ? {
          ...metadata,
          ...Object.entries(data.metadata || {}).reduce(
            (acc, [keyringId, metadataEntry]) => {
              acc[keyringId] = metadataEntry
              return acc
            },
            {} as SerializedVaultData["metadata"]
          ),
        }
      : { ...metadata }

    const updatedHiddenAccounts = data.hiddenAccounts
      ? {
          ...hiddenAccounts,
          ...Object.entries(data.hiddenAccounts || {}).reduce(
            (acc, [address, hidden]) => {
              acc[address] = hidden
              return acc
            },
            {} as SerializedVaultData["hiddenAccounts"]
          ),
        }
      : { ...hiddenAccounts }

    const mergedVaultData = {
      wallets: updatedWallets,
      qiHDWallet: updatedQiHDWallet,
      quaiHDWallets: updatedQuaiHDWallets,
      metadata: updatedMetadata,
      hiddenAccounts: updatedHiddenAccounts,
    }
    await this.persistToVault(mergedVaultData)
  }

  // -------------------------- private methods --------------------------
  private getSaltedKey(): SaltedKey {
    if (!this.vaultSaltedKey) {
      throw new Error("Salted key is not initialized")
    }

    return this.vaultSaltedKey
  }

  private async getVaultData(): Promise<EncryptedVault> {
    const { vaults } = await getEncryptedVaults()
    const currentEncryptedVault = vaults.slice(-1)[0]?.vault
    if (currentEncryptedVault) {
      return currentEncryptedVault
    }

    const serializedVaultData: SerializedVaultData = {
      wallets: [],
      qiHDWallet: null,
      quaiHDWallets: [],
      metadata: {},
      hiddenAccounts: {},
    }
    const encryptedVault = await encryptVault(
      serializedVaultData,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore this.cachedKey won't be undefined | null due to requireUnlocked
      this.vaultSaltedKey
    )

    await writeLatestEncryptedVault(encryptedVault)

    return encryptedVault
  }

  private async persistToVault(data: SerializedVaultData): Promise<void> {
    const saltedKey = this.getSaltedKey()
    const encryptedVault = await encryptVault(data, saltedKey)
    await writeLatestEncryptedVault(encryptedVault)
  }
}
