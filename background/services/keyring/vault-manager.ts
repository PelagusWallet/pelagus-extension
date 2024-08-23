import {
  decryptVault,
  deriveSymmetricKeyFromPassword,
  EncryptedVault,
  encryptVault,
  SaltedKey,
} from "./encryption"
import { getEncryptedVaults, writeLatestEncryptedVault } from "./storage"
import { SerializedVaultData } from "./types"

export type DeleteProps = {
  walletId?: string
  hdWalletId?: string
  metadataKey?: string
  hiddenAccount?: string
}

export interface AddOptions {
  overwriteWallets?: boolean
  overwriteQuaiHDWallets?: boolean
  overwriteMetadata?: boolean
  overwriteHiddenAccounts?: boolean
}

export interface IVaultManager {
  clearSymmetricKey(): void
  isSymmetricKeyInitialized(): boolean
  initializeWithPassword(password: string): Promise<void>

  get(): Promise<SerializedVaultData>
  add(data: Partial<SerializedVaultData>, options: AddOptions): Promise<void>
  delete(options: DeleteProps): Promise<void>
  update(data: Partial<SerializedVaultData>): Promise<void>
}

export class VaultManager implements IVaultManager {
  private cachedVaultSymmetricKey: SaltedKey | null = null

  // -------------------------- public methods --------------------------
  public clearSymmetricKey(): void {
    this.cachedVaultSymmetricKey = null
  }

  public isSymmetricKeyInitialized(): boolean {
    return this.cachedVaultSymmetricKey !== null
  }

  public async initializeWithPassword(password: string): Promise<void> {
    await this.createSymmetricKey(password)
  }

  public async get(): Promise<SerializedVaultData> {
    const saltedKey = this.getSaltedKey()
    const currentEncryptedVault = await this.getData()
    return decryptVault<SerializedVaultData>(currentEncryptedVault, saltedKey)
  }

  public async add(
    data: Partial<SerializedVaultData>,
    options: AddOptions = {}
  ): Promise<void> {
    const { wallets, quaiHDWallets, metadata, hiddenAccounts } =
      await this.get()

    const mergedVaultData: SerializedVaultData = {
      wallets: options.overwriteWallets
        ? data.wallets ?? []
        : [...wallets, ...(data.wallets ?? [])],

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

    await this.saveData(mergedVaultData)
  }

  public async delete(options: DeleteProps): Promise<void> {
    const { wallets, quaiHDWallets, metadata, hiddenAccounts } =
      await this.get()

    const filteredWallets = options.walletId
      ? wallets.filter((wallet) => wallet.id !== options.walletId)
      : wallets

    const filteredHDWallets = options.hdWalletId
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
      quaiHDWallets: filteredHDWallets,
      metadata: updatedMetadata,
      hiddenAccounts: updatedHiddenAccounts,
    }
    await this.saveData(mergedVaultData)
  }

  public async update(data: Partial<SerializedVaultData>): Promise<void> {
    const { wallets, quaiHDWallets, metadata, hiddenAccounts } =
      await this.get()

    const updatedWallets = data.wallets
      ? wallets.map(
          (wallet) =>
            data.wallets?.find((newWallet) => newWallet.id === wallet.id) ||
            wallet
        )
      : [...wallets]

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
      quaiHDWallets: updatedQuaiHDWallets,
      metadata: updatedMetadata,
      hiddenAccounts: updatedHiddenAccounts,
    }
    await this.saveData(mergedVaultData)
  }

  // -------------------------- private methods --------------------------
  private getSaltedKey(): SaltedKey {
    if (!this.cachedVaultSymmetricKey) {
      throw new Error("Salted key is not initialized")
    }

    return this.cachedVaultSymmetricKey
  }

  private async createSymmetricKey(password: string): Promise<void> {
    const { vaults } = await getEncryptedVaults()
    const currentEncryptedVault = vaults.slice(-1)[0]?.vault

    this.cachedVaultSymmetricKey = await deriveSymmetricKeyFromPassword(
      password,
      currentEncryptedVault?.salt
    )
  }

  private async getData(): Promise<EncryptedVault> {
    const { vaults } = await getEncryptedVaults()
    const currentEncryptedVault = vaults.slice(-1)[0]?.vault
    if (currentEncryptedVault) {
      return currentEncryptedVault
    }

    const serializedVaultData: SerializedVaultData = {
      wallets: [],
      quaiHDWallets: [],
      metadata: {},
      hiddenAccounts: {},
    }
    const encryptedVault = await encryptVault(
      serializedVaultData,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore this.cachedKey won't be undefined | null due to requireUnlocked
      this.cachedKey
    )

    await writeLatestEncryptedVault(encryptedVault)

    return encryptedVault
  }

  private async saveData(data: SerializedVaultData): Promise<void> {
    const saltedKey = this.getSaltedKey()
    const encryptedVault = await encryptVault(data, saltedKey)
    await writeLatestEncryptedVault(encryptedVault)
  }
}
