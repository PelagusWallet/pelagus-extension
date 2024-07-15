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
import { SerializedHDWallet } from "quais/lib/commonjs/wallet/hdwallet"
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
  Events,
  InternalSignerWithType,
  Keyring,
  KeyringAccountSigner,
  PrivateKey,
  SerializedPrivateKey,
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

export const MAX_KEYRING_IDLE_TIME = 60 * MINUTE
export const MAX_OUTSIDE_IDLE_TIME = 60 * MINUTE

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

  private wallets: Wallet[] = []

  private quaiHDWallets: QuaiHDWallet[] = []

  private readonly quaiHDWalletAccountIndex: number = 0

  private keyringMetadata: {
    [keyringId: string]: { source: SignerImportSource }
  } = {}

  private hiddenAccounts: { [address: HexString]: boolean } = {}

  /**
   * The last time a keyring took an action that required the service to be
   * unlocked (signing, adding a keyring, etc.)
   */
  private lastKeyringActivity: UNIXTime | undefined

  /**
   * The last time the keyring was notified of an activity outside the
   * keyring. {@see markOutsideActivity}
   */
  private lastOutsideActivity: UNIXTime | undefined

  static create: ServiceCreatorFunction<Events, KeyringService, []> =
    async () => {
      return new this()
    }

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
    // Emit locked status on startup. Should always be locked, but the main
    // goal is to have external viewers synced to internal state no matter what
    // it is. Don't emit if there are no quaiHDWallets to unlock.
    await super.internalStartService()
    if ((await getEncryptedVaults()).vaults.length > 0) {
      this.emitter.emit("locked", this.locked())
    }
  }

  override async internalStopService(): Promise<void> {
    await this.lock()
    await super.internalStopService()
  }

  /**
   * @return True if the keyring is locked, false if it is unlocked.
   */
  public locked(): boolean {
    return this.cachedKey === null
  }

  /**
   * Update activity timestamps and emit unlocked event.
   */
  private internalUnlock(): void {
    this.lastKeyringActivity = Date.now()
    this.lastOutsideActivity = Date.now()
    this.emitter.emit("locked", false)
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
   * @param ignoreExistingVaults If true, ignore any existing, previously
   *        persisted vaults on unlock, instead starting with a clean slate.
   *        This option makes sense if a user has lost their password, and needs
   *        to generate a new keyring.
   *
   *        Note that old vaults aren't deleted, and can still be recovered
   *        later in an emergency.
   * @returns true if the service was successfully unlocked using the password,
   *          and false otherwise.
   */
  public async unlock(
    password: string,
    ignoreExistingVaults = false
  ): Promise<boolean> {
    if (!this.locked()) {
      logger.warn("KeyringService is already unlocked!")
      this.internalUnlock()
      return true
    }

    if (!ignoreExistingVaults) {
      await this.loadKeyrings(password)
    }

    // if there's no vault, or we want to force a new vault, generate a new key and unlock
    if (!this.cachedKey) {
      this.cachedKey = await deriveSymmetricKeyFromPassword(password)
      await this.persistKeyrings()
    }

    this.internalUnlock()
    return true
  }

  /**
   * Lock the keyring service, deleting references to the cached vault
   * encryption key and quaiHDWallets.
   */
  public async lock(): Promise<void> {
    this.lastKeyringActivity = undefined
    this.lastOutsideActivity = undefined
    this.cachedKey = null
    this.quaiHDWallets = []
    this.keyringMetadata = {}
    this.wallets = []
    this.emitter.emit("locked", true)
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
      if (!this.locked()) {
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
    if (this.locked()) {
      throw new Error("KeyringService must be unlocked.")
    }

    this.lastKeyringActivity = Date.now()
    this.markOutsideActivity()
  }

  private emitKeyrings() {
    if (this.locked()) {
      this.emitter.emit("keyrings", {
        privateKeys: [],
        keyrings: [],
        keyringMetadata: {},
      })
    } else {
      const quaiHDWallets = this.getQuaiHDWallets()
      const privateKeys = this.getWallets()

      this.emitter.emit("keyrings", {
        privateKeys,
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
          address = this.importWalletWithPrivateKey(signerMetadata.privateKey)
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

      this.hiddenAccounts[address] = false
      await this.persistKeyrings()
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
    const quaiMnemonic = Mnemonic.fromPhrase(mnemonic)
    const newQuaiHDWallet = QuaiHDWallet.fromMnemonic(quaiMnemonic)

    const existingQuaiHDWallet = this.quaiHDWallets.find(
      (HDWallet) => HDWallet.xPub === newQuaiHDWallet.xPub
    )
    if (existingQuaiHDWallet) {
      const { address } = existingQuaiHDWallet.getAddressesForAccount(
        this.quaiHDWalletAccountIndex
      )[0]
      return address
    }

    this.quaiHDWallets.push(newQuaiHDWallet)

    const { address } = await newQuaiHDWallet.getNextAddress(
      this.quaiHDWalletAccountIndex,
      Zone.Cyprus1
    )

    // If address was previously imported as a private key then remove it
    if (this.findWalletByAddress(address)) {
      await this.removeWallet(address)
    }

    this.keyringMetadata[newQuaiHDWallet.xPub] = { source }

    return address
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

  /**
   * Import wallet with private key
   * @param privateKey - string
   * @returns string - address of imported or existing account
   */
  private importWalletWithPrivateKey(privateKey: string): string {
    const newWallet = new Wallet(privateKey)
    const { address } = newWallet

    if (!isGoldenAgeQuaiAddress(address)) return ""

    if (this.findSigner(address)) return address

    this.wallets.push(newWallet)
    this.keyringMetadata[address] = {
      source: SignerImportSource.import,
    }
    return address
  }

  public async exportWalletPrivateKey(address: string): Promise<string> {
    this.requireUnlocked()

    const signerWithType = this.findSigner(address)
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
  }: KeyringAccountSigner): Promise<HexString> {
    this.requireUnlocked()

    const quaiHDWallet = this.quaiHDWallets.find(
      (HDWallet) => HDWallet.xPub === keyringID
    )
    if (!quaiHDWallet) {
      throw new Error("QuaiHDWallet not found.")
    }

    const { address } = await quaiHDWallet.getNextAddress(
      this.quaiHDWalletAccountIndex,
      zone
    )

    await this.persistKeyrings()
    await this.emitter.emit("address", address)
    this.emitKeyrings()

    return address
  }

  public async removeQuaiHDWallet(address: string): Promise<void> {
    const foundedHDWallet = this.findQuaiHDWalletByAddress(address)
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
      (HDWallet) => HDWallet.xPub !== foundedHDWallet.xPub
    )

    if (filteredQuaiHDWallets.length === this.quaiHDWallets.length) {
      throw new Error(
        `Attempting to remove Quai HDWallet that does not exist. xPub: (${foundedHDWallet.xPub})`
      )
    }
    this.quaiHDWallets = filteredQuaiHDWallets

    await this.persistKeyrings()
    this.emitKeyrings()
  }

  public async removeWallet(address: HexString): Promise<void> {
    const filteredPrivateKeys = this.wallets.filter(
      (wallet) => !sameQuaiAddress(wallet.address, address)
    )

    if (filteredPrivateKeys.length === this.wallets.length) {
      throw new Error(
        `Attempting to remove wallet that does not exist. Address: (${address})`
      )
    }

    this.wallets = filteredPrivateKeys
    delete this.keyringMetadata[address]

    await this.persistKeyrings()
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
  private findSigner(address: AddressLike): InternalSignerWithType | null {
    // we format the address because it can also come from a request from outside the wallet,
    // which may be in the wrong format
    const formatedAddress = getAddress(address as string)

    const HDWallet = this.findQuaiHDWalletByAddress(address)
    if (HDWallet) {
      return {
        signer: HDWallet,
        address: formatedAddress,
        type: SignerSourceTypes.keyring,
      }
    }

    const privateKey = this.findWalletByAddress(address)
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
  private findQuaiHDWalletByAddress(address: AddressLike): QuaiHDWallet | null {
    const foundedHDWallet = this.quaiHDWallets.find((HDWallet) =>
      HDWallet.getAddressesForAccount(this.quaiHDWalletAccountIndex).find(
        (HDWalletAddress) =>
          sameQuaiAddress(HDWalletAddress.address, address as string)
      )
    )

    return foundedHDWallet ?? null
  }

  /**
   * Find a wallet imported with a private key
   *
   * @param address - the account address desired to search the wallet for.
   * @returns Quai`s Wallet object
   */
  private findWalletByAddress(address: AddressLike): Wallet | null {
    const foundedWallet = this.wallets.find((wallet) =>
      sameQuaiAddress(wallet.address, address as string)
    )

    return foundedWallet ?? null
  }

  public getWallets(): PrivateKey[] {
    this.requireUnlocked()

    return this.wallets.map((wallet) => ({
      type: KeyringTypes.singleSECP,
      addresses: [wallet.address],
      id: wallet.signingKey.publicKey,
      path: null,
    }))
  }

  public getQuaiHDWallets(): Keyring[] {
    this.requireUnlocked()

    return this.quaiHDWallets.map((HDWallet) => ({
      type: KeyringTypes.mnemonicBIP39S256,
      addresses: [
        ...HDWallet.getAddressesForAccount(this.quaiHDWalletAccountIndex)
          .filter(({ address }) => !this.hiddenAccounts[address])
          .map(({ address }) => address),
      ],
      id: HDWallet.xPub,
      path: null, // TODO-MIGRATION
    }))
  }

  /**
   * Return the source of a given address' keyring if it exists. If an
   * address does not have a keyring associated with it - returns null.
   */
  public getQuaiHDWalletSourceForAddress(
    address: string
  ): SignerImportSource | null {
    const foundedHDWallet = this.findQuaiHDWalletByAddress(address)
    if (!foundedHDWallet) {
      logger.error("QuaiHDWallet associated with an address is not found.")
      return null
    }

    return this.keyringMetadata[foundedHDWallet.xPub].source
  }
  // -------------------------------------------------------------------

  // -------------------------------- Sign -----------------------------
  public async signQuaiTransaction(
    txRequest: QuaiTransactionRequest
  ): Promise<string> {
    this.requireUnlocked()

    const { from: fromAddress } = txRequest

    const signerWithType = this.findSigner(fromAddress)
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

    const signerWithType = this.findSigner(fromAddress)
    if (!signerWithType) {
      throw new Error(
        `Signing transaction failed. Signer for address ${fromAddress} was not found.`
      )
    }

    const { jsonRpc } = globalThis.main.chainService.getCurrentProvider()

    if (isSignerPrivateKeyType(signerWithType)) {
      const walletResponse = await signerWithType.signer
        .connect(jsonRpc)
        .sendTransaction(transactionRequest)

      return walletResponse as QuaiTransactionResponse
    }

    signerWithType.signer.connect(jsonRpc)
    const quaiHDWalletResponse = await signerWithType.signer.sendTransaction(
      transactionRequest
    )

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

    const signerWithType = this.findSigner(address)
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

    const signerWithType = this.findSigner(address)
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
    try {
      const { vaults } = await getEncryptedVaults()
      const currentEncryptedVault = vaults.slice(-1)[0]?.vault
      if (!currentEncryptedVault) return

      const saltedKey = await deriveSymmetricKeyFromPassword(
        password,
        currentEncryptedVault.salt
      )

      const plainTextVault: SerializedVaultData = await decryptVault(
        currentEncryptedVault,
        saltedKey
      )

      this.cachedKey = saltedKey
      this.wallets = []
      this.quaiHDWallets = []
      this.keyringMetadata = {}
      this.hiddenAccounts = {}

      plainTextVault.wallets?.forEach((wallet) =>
        this.wallets.push(new Wallet(wallet.privateKey))
      )
      const deserializedHDWallets = await Promise.all(
        plainTextVault.quaiHDWallets.map((HDWallet) =>
          QuaiHDWallet.deserialize(HDWallet)
        )
      )
      this.quaiHDWallets.push(...deserializedHDWallets)
      this.keyringMetadata = {
        ...plainTextVault.metadata,
      }
      this.hiddenAccounts = {
        ...plainTextVault.hiddenAccounts,
      }

      this.emitKeyrings()
    } catch (err) {
      logger.error("Error while loading vault", err)
    }
  }

  private async persistKeyrings() {
    this.requireUnlocked()

    const serializedQuaiHDWallets: SerializedHDWallet[] =
      this.quaiHDWallets.map((HDWallet) => HDWallet.serialize())

    const serializedWallets: SerializedPrivateKey[] = this.wallets.map(
      (wallet) => {
        const { privateKey } = wallet
        const signingKey = new SigningKey(privateKey)
        const { publicKey } = signingKey

        return {
          version: 1,
          id: publicKey,
          privateKey,
        }
      }
    )

    const hiddenAccounts = { ...this.hiddenAccounts }
    const metadata = { ...this.keyringMetadata }

    const serializedVaultData: SerializedVaultData = {
      wallets: serializedWallets,
      quaiHDWallets: serializedQuaiHDWallets,
      metadata,
      hiddenAccounts,
    }
    const encryptedVault = await encryptVault(
      serializedVaultData,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore this.cachedKey won't be undefined | null due to requireUnlocked
      this.cachedKey
    )

    await writeLatestEncryptedVault(encryptedVault)
  }
}
