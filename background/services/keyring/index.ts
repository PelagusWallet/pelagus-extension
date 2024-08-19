import {
  AddressLike,
  getAddress,
  getBytes,
  Mnemonic,
  QuaiHDWallet,
  SigningKey,
  Wallet,
  Zone,
} from "quais"
import {
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import { DataHexString } from "quais/lib/commonjs/utils"
import {
  decryptVault,
  deriveSymmetricKeyFromPassword,
  encryptVault,
  SaltedKey,
} from "./encryption"
import BaseService from "../base"
import { getEncryptedVaults, writeLatestEncryptedVault } from "./storage"
import {
  AddToVaultOptions,
  Events,
  InternalSignerWithType,
  Keyring,
  KeyringAccountSigner,
  PrivateKey,
  SerializedVaultData,
  SignerImportMetadata,
  SignerImportSource,
  SignerSourceTypes,
} from "./types"
import { MINUTE } from "../../constants"
import { ServiceCreatorFunction } from "../types"
import { EIP712TypedData, HexString, KeyringTypes, UNIXTime } from "../../types"
import logger from "../../lib/logger"
import { sameQuaiAddress } from "../../lib/utils"
import { generateRandomBytes, isSignerPrivateKeyType } from "./utils"
import { isGoldenAgeQuaiAddress } from "../../utils/addresses"

export const MAX_KEYRING_IDLE_TIME = 10 * MINUTE
export const MAX_OUTSIDE_IDLE_TIME = 10 * MINUTE

/*
 * KeyringService is responsible for all key material, as well as applying the
 * material to sign messages, sign transactions, and derive child keypair.
 *
 * The service can be in two states, locked or unlocked, and starts up locked.
 * Keyrings are persisted in encrypted form when the service is locked.
 *
 * When unlocked, the service automatically locks itself after it has not seen
 * activity for a certain amount of time. The service can be notified of
 * outside activity that should be considered for the purposes of keeping the
 * service unlocked. No keyring activity for 30 minutes causes the service to
 * lock, while no outside activity for 30 minutes has the same effect.
 */
export default class KeyringService extends BaseService<Events> {
  private cachedKey: SaltedKey | null = null

  private wallets: PrivateKey[] = []

  private quaiHDWallets: Keyring[] = []

  private lastKeyringActivity: UNIXTime | undefined

  private lastOutsideActivity: UNIXTime | undefined

  private readonly quaiHDWalletAccountIndex: number = 0

  private keyringMetadata: {
    [keyringId: string]: { source: SignerImportSource }
  } = {}

  private hiddenAccounts: { [address: HexString]: boolean } = {}

  static create: ServiceCreatorFunction<Events, KeyringService, []> =
    async () => new this()

  private constructor() {
    super({
      autolock: {
        schedule: {
          periodInMinutes: 1,
        },
        handler: () => {
          this.autolockIfNeeded()
        },
      },
    })
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()

    // Don't emit if there are no quaiHDWallets to unlock
    const { vaults } = await getEncryptedVaults()
    if (!vaults.length) return

    // Emit locked status on startup. Should always be locked, but the main
    // goal is to have external viewers synced to internal state no matter what it is.
    await this.emitter.emit("locked", this.isLocked())
  }

  override async internalStopService(): Promise<void> {
    await this.lock()
    await super.internalStopService()
  }

  /**
   * @return True if the keyring is locked, false if it is unlocked.
   */
  public isLocked(): boolean {
    return this.cachedKey === null
  }

  /**
   * Update activity timestamps and emit unlocked event.
   */
  private async internalUnlock(): Promise<void> {
    this.lastKeyringActivity = Date.now()
    this.lastOutsideActivity = Date.now()

    await this.emitter.emit("locked", false)
  }

  /**
   * Unlock the keyring with a provided password, initializing from the most
   * recently persisted keyring vault if one exists.
   *
   * @param password A user-chosen string used to encrypt keyring vaults.
   *        Unlocking will fail if an existing vault is found, and this password
   *        can't decrypt it.
   *
   *        Note that losing this password means losing access to any key
   *        material stored in a vault.
   * @returns true if the service was successfully unlocked using the password,
   *          and false otherwise.
   */
  public async unlock(password: string): Promise<boolean> {
    try {
      if (!this.isLocked()) {
        logger.warn("KeyringService is already unlocked!")
        await this.internalUnlock()
        return true
      }

      await this.loadKeyrings(password)

      await this.internalUnlock()
      // await this.persistKeyrings({})
      return true
    } catch (error) {
      logger.error("Error while unlocking keyring service")
      return false
    }
  }

  /**
   * Lock the keyring service, deleting references to the cached vault
   * encryption key and quaiHDWallets.
   */
  public async lock(): Promise<void> {
    this.cachedKey = null
    this.lastKeyringActivity = undefined
    this.lastOutsideActivity = undefined
    this.keyringMetadata = {}

    await this.emitter.emit("locked", true)
    this.emitKeyrings()
  }

  /**
   * Notifies the keyring that an outside activity occurred. Outside activities
   * are used to delay auto locking.
   */
  public markOutsideActivity(): void {
    if (typeof this.lastOutsideActivity !== "undefined") {
      this.lastOutsideActivity = Date.now()
    }
  }

  // Locks the keyring if the time since last keyring or outside activity exceeds preset levels.
  private async autolockIfNeeded(): Promise<void> {
    if (
      typeof this.lastKeyringActivity === "undefined" ||
      typeof this.lastOutsideActivity === "undefined"
    ) {
      // Normally both activity counters should be undefined only if the keyring
      // is locked, otherwise they should both be set; regardless, fail-safe if
      // either is undefined and the keyring is unlocked.
      if (!this.isLocked()) {
        await this.lock()
      }

      return
    }

    const now = Date.now()
    const timeSinceLastKeyringActivity = now - this.lastKeyringActivity
    const timeSinceLastOutsideActivity = now - this.lastOutsideActivity

    if (
      timeSinceLastKeyringActivity >= MAX_KEYRING_IDLE_TIME ||
      timeSinceLastOutsideActivity >= MAX_OUTSIDE_IDLE_TIME
    ) {
      await this.lock()
    }
  }

  // Throw if the keyring is not unlocked; if it is, update the last keyring activity timestamp.
  private requireUnlocked(): void {
    if (this.isLocked()) {
      throw new Error("KeyringService must be unlocked.")
    }

    this.lastKeyringActivity = Date.now()
    this.markOutsideActivity()
  }

  private emitKeyrings() {
    if (this.isLocked()) {
      this.emitter.emit("keyrings", {
        privateKeys: [],
        keyrings: [],
        keyringMetadata: {},
      })
    } else {
      const { wallets, quaiHDWallets } = this

      this.emitter.emit("keyrings", {
        privateKeys: wallets,
        keyrings: quaiHDWallets,
        keyringMetadata: { ...this.keyringMetadata },
      })
    }
  }

  // -------------------------------------------------------------------
  /**
   * Import new internal signer
   *
   * @param signerMetadata any signer with type and metadata
   * @returns null | string - if new account was added or existing account was found then returns an address
   */
  public async importKeyring(
    signerMetadata: SignerImportMetadata
  ): Promise<string> {
    this.requireUnlocked()

    try {
      let address: string

      switch (signerMetadata.type) {
        case SignerSourceTypes.privateKey:
          address = await this.importWalletWithPrivateKey(
            signerMetadata.privateKey
          )
          break
        case SignerSourceTypes.keyring:
          address = await this.importQuaiHDWalletWithMnemonic(
            signerMetadata.mnemonic,
            signerMetadata.source
          )
          break
        default:
          throw new Error(`Unsupported signer type`)
      }

      if (!address) {
        throw new Error("Failed to import keyring")
      }

      this.emitter.emit("address", address)
      this.emitKeyrings()

      return address
    } catch (error) {
      logger.error("Signer import failed:", error)
      return ""
    }
  }

  /**
   * Import quai HDWallet and pull the first address from that
   * keyring for system use.
   *
   * @param mnemonic - a seed phrase
   * @param source
   * @returns The address string.
   */
  private async importQuaiHDWalletWithMnemonic(
    mnemonic: string,
    source: SignerImportSource
  ): Promise<string> {
    const mnemonicFromPhrase = Mnemonic.fromPhrase(mnemonic)
    const newQuaiHDWallet = QuaiHDWallet.fromMnemonic(mnemonicFromPhrase)

    const existingQuaiHDWallet = await this.getQuaiHDWallet(
      newQuaiHDWallet.xPub
    )
    if (existingQuaiHDWallet) {
      const { address } = existingQuaiHDWallet.getAddressesForAccount(
        this.quaiHDWalletAccountIndex
      )[0]
      return address
    }

    const { address } = await newQuaiHDWallet.getNextAddress(
      this.quaiHDWalletAccountIndex,
      Zone.Cyprus1
    )

    const serializedQuaiHDWallet = newQuaiHDWallet.serialize()

    // If address was previously imported as a private key then remove it
    if (await this.findWalletByAddress(address)) {
      await this.removeWallet(address)
    }

    this.quaiHDWallets = [
      ...this.quaiHDWallets,
      {
        type: KeyringTypes.mnemonicBIP39S256,
        addresses: [
          ...newQuaiHDWallet
            .getAddressesForAccount(this.quaiHDWalletAccountIndex)
            .filter(
              (quaiHDWallet) => !this.hiddenAccounts[quaiHDWallet.address]
            )
            .map((quaiHDWallet) => quaiHDWallet.address),
        ],
        id: newQuaiHDWallet.xPub,
        path: null,
      },
    ]

    this.keyringMetadata[newQuaiHDWallet.xPub] = {
      source,
    }
    await this.addToVault({
      quaiHDWallets: [serializedQuaiHDWallet],
      metadata: { [newQuaiHDWallet.xPub]: { source } },
    })

    return address
  }

  /**
   * Import wallet with private key
   * @param privateKeyParam - string
   * @returns string - address of imported or existing account
   */
  private async importWalletWithPrivateKey(
    privateKeyParam: string
  ): Promise<string> {
    const newWallet = new Wallet(privateKeyParam)
    const { address } = newWallet

    if (!isGoldenAgeQuaiAddress(address)) return ""

    if (await this.findSigner(address)) return address

    const { publicKey, privateKey } = new SigningKey(newWallet.privateKey)

    const serializedWallet = {
      version: 1,
      id: publicKey,
      privateKey,
    }

    this.wallets = [
      ...this.wallets,
      {
        type: KeyringTypes.singleSECP,
        addresses: [address],
        id: publicKey,
        path: null,
      },
    ]

    this.keyringMetadata[publicKey] = {
      source: SignerImportSource.import,
    }

    await this.addToVault({
      wallets: [serializedWallet],
      metadata: { [publicKey]: { source: SignerImportSource.import } },
    })

    return address
  }

  public async exportWalletPrivateKey(address: string): Promise<string> {
    this.requireUnlocked()

    const signerWithType = await this.findSigner(address)
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

  /**
   * Derive and return the next address for a KeyringAccountSigner representing
   * an QuaiHDWallet.
   */
  async deriveAddress({
    keyringID,
    zone,
  }: KeyringAccountSigner): Promise<void> {
    this.requireUnlocked()

    const quaiHDWallet = await this.getQuaiHDWallet(keyringID)
    if (!quaiHDWallet) {
      throw new Error("QuaiHDWallet not found.")
    }

    const { address } = await quaiHDWallet.getNextAddress(
      this.quaiHDWalletAccountIndex,
      zone
    )

    this.quaiHDWallets = this.quaiHDWallets.map((HDWallet) => {
      return HDWallet?.id === quaiHDWallet.xPub
        ? {
            ...HDWallet,
            addresses: [...HDWallet.addresses, address],
          }
        : HDWallet
    })

    await this.updateVault({ quaiHDWallets: [quaiHDWallet.serialize()] })

    await this.emitter.emit("address", address)

    this.emitKeyrings()
  }

  /**
   * Generate a new hd wallet mnemonic
   *
   * @param type - the type of keyring to generate
   * @returns An object containing the string ID of the new keyring and the
   *          mnemonic for the new keyring. Note that the mnemonic can only be
   *          accessed at generation time through this return value.
   */
  public async generateQuaiHDWalletMnemonic(
    type: KeyringTypes
  ): Promise<{ id: string; mnemonic: string[] }> {
    this.requireUnlocked()

    if (type !== KeyringTypes.mnemonicBIP39S256) {
      throw new Error(
        "KeyringService only supports generating 256-bit HD key trees"
      )
    }

    const randomBytes = generateRandomBytes(24)
    const { phrase } = Mnemonic.fromEntropy(randomBytes)

    // used only for redux, so we can use quaiHDWallets length as id
    const keyringIdToVerify = this.quaiHDWallets.length.toString()

    return { id: keyringIdToVerify, mnemonic: phrase.split(" ") }
  }

  public async removeQuaiHDWallet(address: string): Promise<void> {
    const foundedHDWallet = await this.findQuaiHDWalletByAddress(address)
    if (!foundedHDWallet) {
      logger.error("QuaiHDWallet associated with an address is not found.")
      return
    }

    foundedHDWallet
      .getAddressesForAccount(this.quaiHDWalletAccountIndex)
      .forEach(({ address: walletAddress }) => {
        delete this.hiddenAccounts[walletAddress]
      })

    const filteredQuaiHDWallets = this.quaiHDWallets.filter(
      (HDWallet) => HDWallet.id !== foundedHDWallet.xPub
    )

    if (filteredQuaiHDWallets.length === this.quaiHDWallets.length) {
      throw new Error(
        `Attempting to remove Quai HDWallet that does not exist. xPub: (${foundedHDWallet.xPub})`
      )
    }
    this.quaiHDWallets = filteredQuaiHDWallets

    await this.removeFromVault({
      hdWalletId: foundedHDWallet.serialize().phrase,
    })
    this.emitKeyrings()
  }

  public async removeWallet(address: HexString): Promise<void> {
    let targetWalletPublicKey = ""
    const filteredPrivateKeys = this.wallets.filter((wallet) => {
      if (!sameQuaiAddress(wallet.addresses[0], address)) return true

      targetWalletPublicKey = wallet.id
      return false
    })

    if (filteredPrivateKeys.length === this.wallets.length) {
      throw new Error(
        `Attempting to remove wallet that does not exist. Address: (${address})`
      )
    }

    this.wallets = filteredPrivateKeys
    delete this.keyringMetadata[targetWalletPublicKey]

    const { wallets } = await this.retrieveVaultData()
    const walletsWithoutTargetWallet = wallets.filter(
      (serializedWallet) => serializedWallet.id !== targetWalletPublicKey
    )

    await this.addToVault(
      { wallets: walletsWithoutTargetWallet },
      { overwriteWallets: true }
    )
    await this.removeFromVault({ metadataKey: targetWalletPublicKey })

    this.emitKeyrings()
  }
  // -------------------------------------------------------------------

  // ----------------------------- Find/Get -----------------------------
  /**
   * Finds the signer associated with a given account.
   *
   * @param address - The account to find the signer for.
   * @returns An object containing the signer and its type, or null if no signer is found.
   */
  private async findSigner(
    address: AddressLike
  ): Promise<InternalSignerWithType | null> {
    // we format the address because it can also come from a request from outside the wallet,
    // which may be in the wrong format
    const formatedAddress = getAddress(address as string)

    const HDWallet = await this.findQuaiHDWalletByAddress(address)
    if (HDWallet) {
      return {
        signer: HDWallet,
        address: formatedAddress,
        type: SignerSourceTypes.keyring,
      }
    }

    const privateKey = await this.findWalletByAddress(address)
    if (privateKey) {
      return {
        signer: privateKey,
        address: formatedAddress,
        type: SignerSourceTypes.privateKey,
      }
    }

    return null
  }

  /**
   * Find keyring associated with an address.
   *
   * @param address - the account address desired to search the keyring for.
   * @returns HD keyring object
   */
  private async findQuaiHDWalletByAddress(
    address: AddressLike
  ): Promise<QuaiHDWallet | undefined> {
    const { quaiHDWallets } = await this.retrieveVaultData()

    const deserializedHDWallets: QuaiHDWallet[] = await Promise.all(
      quaiHDWallets.map((HDWallet) => QuaiHDWallet.deserialize(HDWallet))
    )

    return deserializedHDWallets.find((HDWallet) =>
      HDWallet.getAddressesForAccount(this.quaiHDWalletAccountIndex).find(
        (HDWalletAddress) =>
          sameQuaiAddress(HDWalletAddress.address, address as string)
      )
    )
  }

  /**
   * Find a wallet imported with a private key
   *
   * @param address - the account address desired to search the wallet for.
   * @returns Quai`s Wallet object
   */
  private async findWalletByAddress(
    address: AddressLike
  ): Promise<Wallet | undefined> {
    const { wallets } = await this.retrieveVaultData()

    return wallets
      .map((serializedWallet) => new Wallet(serializedWallet.privateKey))
      .find((deserializedWallet) =>
        sameQuaiAddress(deserializedWallet.address, address as string)
      )
  }

  private async getQuaiHDWallet(
    xPub: string
  ): Promise<QuaiHDWallet | undefined> {
    const { quaiHDWallets } = await this.retrieveVaultData()

    const deserializedHDWallets: QuaiHDWallet[] = await Promise.all(
      quaiHDWallets.map((HDWallet) => QuaiHDWallet.deserialize(HDWallet))
    )

    return deserializedHDWallets.find(
      (HDWallet: QuaiHDWallet) => HDWallet.xPub === xPub
    )
  }

  /**
   * Return the source of a given address' keyring if it exists. If an
   * address does not have a keyring associated with it - returns null.
   */
  public async getKeyringSourceForAddress(
    address: string
  ): Promise<SignerImportSource | null> {
    this.requireUnlocked()

    const foundedKeyring = [...this.quaiHDWallets, ...this.wallets].find(
      (keyring) => keyring.addresses.includes(address)
    )
    if (!foundedKeyring) {
      logger.error("foundedKeyring associated with an address is not found.")
      return null
    }

    return this.keyringMetadata[foundedKeyring.id].source
  }
  // -------------------------------------------------------------------

  // -------------------------------- Sign -----------------------------
  public async signQuaiTransaction(
    txRequest: QuaiTransactionRequest
  ): Promise<string> {
    this.requireUnlocked()

    const { from: fromAddress } = txRequest

    const signerWithType = await this.findSigner(fromAddress)
    if (!signerWithType) {
      throw new Error(
        `Signing transaction failed. Signer for address ${fromAddress} was not found.`
      )
    }

    return signerWithType.signer.signTransaction(txRequest)
  }

  public async signAndSendQuaiTransaction(
    transactionRequest: QuaiTransactionRequest
  ): Promise<QuaiTransactionResponse> {
    this.requireUnlocked()

    const { from: fromAddress } = transactionRequest

    const signerWithType = await this.findSigner(fromAddress)
    if (!signerWithType) {
      throw new Error(
        `Signing transaction failed. Signer for address ${fromAddress} was not found.`
      )
    }

    const { jsonRpcProvider } = globalThis.main.chainService

    if (isSignerPrivateKeyType(signerWithType)) {
      const walletResponse = await signerWithType.signer
        .connect(jsonRpcProvider)
        .sendTransaction(transactionRequest)

      return walletResponse as QuaiTransactionResponse
    }

    signerWithType.signer.connect(jsonRpcProvider)
    const quaiHDWalletResponse = await signerWithType.signer
      .sendTransaction(transactionRequest)
      .catch((e) => {
        logger.error(e)
        throw new Error("Failed send transaction")
      })

    return quaiHDWalletResponse as QuaiTransactionResponse
  }

  /**
   * Sign typed data based on EIP-712 with the usage of eth_signTypedData_v4 method,
   * more information about the EIP can be found at https://eips.ethereum.org/EIPS/eip-712
   *
   * @param address
   * @param typedData - the data to be signed
   */
  public async signTypedData(
    address: string,
    typedData: EIP712TypedData
  ): Promise<string> {
    this.requireUnlocked()

    const { domain, types, message } = typedData

    const signerWithType = await this.findSigner(address)
    if (!signerWithType) {
      throw new Error(
        `Signing transaction failed. Signer for address ${address} was not found.`
      )
    }

    try {
      const { address: formatedAddress } = signerWithType

      return isSignerPrivateKeyType(signerWithType)
        ? await signerWithType.signer.signTypedData(domain, types, message)
        : await signerWithType.signer.signTypedData(
            formatedAddress,
            domain,
            types,
            message
          )
    } catch (error) {
      throw new Error("Signing data failed")
    }
  }

  /**
   * Sign data based on EIP-191 with the usage of personal_sign method,
   * more information about the EIP can be found at https://eips.ethereum.org/EIPS/eip-191
   *
   * @param address
   * @param signingData - the data to be signed
   */
  public async personalSign(
    address: string,
    signingData: DataHexString
  ): Promise<string> {
    this.requireUnlocked()

    const signerWithType = await this.findSigner(address)
    if (!signerWithType) {
      throw new Error(
        `Signing transaction failed. Signer for address ${address} was not found.`
      )
    }

    try {
      const messageBytes = getBytes(signingData)
      const { address: formatedAddress } = signerWithType

      return isSignerPrivateKeyType(signerWithType)
        ? await signerWithType.signer.signMessage(messageBytes)
        : await signerWithType.signer.signMessage(formatedAddress, messageBytes)
    } catch (error) {
      throw new Error("Signing data failed")
    }
  }
  // -------------------------------------------------------------------

  // -------------------------------- Vaults --------------------------------
  private async loadKeyrings(password: string) {
    const { vaults } = await getEncryptedVaults()
    const currentEncryptedVault = vaults.slice(-1)[0]?.vault

    const saltedKey = await deriveSymmetricKeyFromPassword(
      password,
      currentEncryptedVault?.salt
    )

    this.cachedKey = saltedKey

    if (!currentEncryptedVault) return

    const plainTextVault = await decryptVault<SerializedVaultData>(
      currentEncryptedVault,
      saltedKey
    )

    this.wallets = []
    this.quaiHDWallets = []
    this.keyringMetadata = {}
    this.hiddenAccounts = {}

    plainTextVault.wallets?.forEach((serializedWallet) => {
      const wallet = new Wallet(serializedWallet.privateKey)
      this.wallets = [
        ...this.wallets,
        {
          type: KeyringTypes.singleSECP,
          addresses: [wallet.address],
          id: wallet.signingKey.publicKey,
          path: null,
        },
      ]
    })

    const deserializedHDWallets = await Promise.all(
      plainTextVault.quaiHDWallets.map((HDWallet) =>
        QuaiHDWallet.deserialize(HDWallet)
      )
    )

    deserializedHDWallets.forEach((quaiHDWallet) => {
      this.quaiHDWallets = [
        ...this.quaiHDWallets,
        {
          type: KeyringTypes.mnemonicBIP39S256,
          addresses: [
            ...quaiHDWallet
              .getAddressesForAccount(this.quaiHDWalletAccountIndex)
              .filter(({ address }) => !this.hiddenAccounts[address])
              .map(({ address }) => address),
          ],
          id: quaiHDWallet.xPub,
          path: null,
        },
      ]
    })

    this.keyringMetadata = {
      ...plainTextVault.metadata,
    }
    this.hiddenAccounts = {
      ...plainTextVault.hiddenAccounts,
    }

    this.emitKeyrings()
  }

  private async addToVault(
    data: Partial<SerializedVaultData>,
    options: AddToVaultOptions = {}
  ): Promise<void> {
    this.requireUnlocked()

    const saltedKey = this.cachedKey
    if (!saltedKey) return

    const { wallets, quaiHDWallets, metadata, hiddenAccounts } =
      await this.retrieveVaultData()

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

    const encryptedVault = await encryptVault(mergedVaultData, saltedKey)
    await writeLatestEncryptedVault(encryptedVault)
  }

  private async updateVault(data: Partial<SerializedVaultData>): Promise<void> {
    this.requireUnlocked()

    const saltedKey = this.cachedKey
    if (!saltedKey) return

    const { wallets, quaiHDWallets, metadata, hiddenAccounts } =
      await this.retrieveVaultData()

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

    const mergedVaultData: SerializedVaultData = {
      wallets: updatedWallets,
      quaiHDWallets: updatedQuaiHDWallets,
      metadata: updatedMetadata,
      hiddenAccounts: updatedHiddenAccounts,
    }

    const encryptedVault = await encryptVault(mergedVaultData, saltedKey)
    await writeLatestEncryptedVault(encryptedVault)
  }

  private async removeFromVault(options: {
    walletId?: string
    hdWalletId?: string
    metadataKey?: string
    hiddenAccount?: string
  }): Promise<void> {
    this.requireUnlocked()

    const saltedKey = this.cachedKey
    if (!saltedKey) return

    const { wallets, quaiHDWallets, metadata, hiddenAccounts } =
      await this.retrieveVaultData()

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

    const mergedVaultData: SerializedVaultData = {
      wallets: filteredWallets,
      quaiHDWallets: filteredHDWallets,
      metadata: updatedMetadata,
      hiddenAccounts: updatedHiddenAccounts,
    }

    const encryptedVault = await encryptVault(mergedVaultData, saltedKey)
    await writeLatestEncryptedVault(encryptedVault)
  }

  private async getVault() {
    const { vaults } = await getEncryptedVaults()
    const currentEncryptedVault = vaults.slice(-1)[0]?.vault
    if (currentEncryptedVault) return currentEncryptedVault

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

  private async retrieveVaultData(): Promise<SerializedVaultData> {
    this.requireUnlocked()

    const currentEncryptedVault = await this.getVault()
    const saltedKey = this.cachedKey
    if (!saltedKey) throw new Error("No cached key found.")

    return decryptVault<SerializedVaultData>(currentEncryptedVault, saltedKey)
  }
}
