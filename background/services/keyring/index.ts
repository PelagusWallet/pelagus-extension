import { Wallet } from "@quais/wallet"
import { parseAndValidateSignedTransaction } from "./utils"
import { parse as parseRawTransaction } from "@quais/transactions"
import HDKeyring, { SerializedHDKeyring } from "@pelagus/hd-keyring"

import { arrayify } from "ethers/lib/utils"
import { normalizeEVMAddress, sameEVMAddress } from "../../lib/utils"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import { getEncryptedVaults, writeLatestEncryptedVault } from "./storage"
import {
  decryptVault,
  deriveSymmetricKeyFromPassword,
  encryptVault,
  SaltedKey,
} from "./encryption"
import { HexString, KeyringTypes, EIP712TypedData, UNIXTime } from "../../types"
import { SignedTransaction, TransactionRequestWithNonce } from "../../networks"

import BaseService from "../base"
import { FORK, MINUTE } from "../../constants"
import { ethersTransactionFromTransactionRequest } from "../chain/utils"
import { FeatureFlags, isEnabled } from "../../features"
import { AddressOnNetwork } from "../../accounts"
import logger from "../../lib/logger"
import { getShardFromAddress } from "../../redux-slices/selectors"

export const MAX_KEYRING_IDLE_TIME = 60 * MINUTE
export const MAX_OUTSIDE_IDLE_TIME = 60 * MINUTE

export type Keyring = {
  type: KeyringTypes
  id: string | null
  path: string | null
  addresses: string[]
}
export type PrivateKey = Keyring & {
  type: KeyringTypes.singleSECP
  path: null
  addresses: [string]
}

export type KeyringAccountSigner = {
  type: "keyring"
  keyringID: string
  shard: string
}
export type PrivateKeyAccountSigner = {
  type: "private-key"
  walletID: string
}

type SerializedPrivateKey = {
  version: number
  id: string
  privateKey: string
}
interface SerializedKeyringData {
  privateKeys: SerializedPrivateKey[]
  keyrings: SerializedHDKeyring[]
  metadata: { [keyringId: string]: { source: SignerImportSource } }
  hiddenAccounts: { [address: HexString]: boolean }
}

interface Events extends ServiceLifecycleEvents {
  locked: boolean
  keyrings: {
    privateKeys: PrivateKey[]
    keyrings: Keyring[]
    keyringMetadata: {
      [keyringId: string]: { source: SignerImportSource }
    }
  }
  address: string
  // TODO message was signed
  signedTx: SignedTransaction
  signedData: string
}

export enum SignerSourceTypes {
  privateKey = "privateKey",
  keyring = "keyring",
}

const isPrivateKey = (
  signer: InternalSignerWithType
): signer is InternalSignerPrivateKey =>
  signer.type === SignerSourceTypes.privateKey

export enum SignerImportSource {
  import = "import",
  internal = "internal",
}

type ImportMetadataPrivateKey = {
  type: SignerSourceTypes.privateKey
  privateKey: string
}
type ImportMetadataHDKeyring = {
  type: SignerSourceTypes.keyring
  mnemonic: string
  source: SignerImportSource
  path?: string
}
export type SignerImportMetadata =
  | ImportMetadataPrivateKey
  | ImportMetadataHDKeyring

type InternalSignerHDKeyring = {
  signer: HDKeyring
  type: SignerSourceTypes.keyring
}
type InternalSignerPrivateKey = {
  signer: Wallet
  type: SignerSourceTypes.privateKey
}
type InternalSignerWithType = InternalSignerPrivateKey | InternalSignerHDKeyring

/*
 * KeyringService is responsible for all key material, as well as applying the
 * material to sign messages, sign transactions, and derive child keypairs.
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
  #cachedKey: SaltedKey | null = null

  #keyrings: HDKeyring[] = []

  #privateKeys: Wallet[] = []

  #keyringMetadata: { [keyringId: string]: { source: SignerImportSource } } = {}

  #hiddenAccounts: { [address: HexString]: boolean } = {}

  /**
   * The last time a keyring took an action that required the service to be
   * unlocked (signing, adding a keyring, etc).
   */
  lastKeyringActivity: UNIXTime | undefined

  /**
   * The last time the keyring was notified of an activity outside of the
   * keyring. {@see markOutsideActivity}
   */
  lastOutsideActivity: UNIXTime | undefined

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
    // it is. Don't emit if there are no keyrings to unlock.
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
  locked(): boolean {
    return this.#cachedKey === null
  }

  /**
   * Update activity timestamps and emit unlocked event.
   */
  #unlock(): void {
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
  async unlock(
    password: string,
    ignoreExistingVaults = false
  ): Promise<boolean> {
    if (!this.locked()) {
      logger.warn("KeyringService is already unlocked!")
      this.#unlock()
      return true
    }

    if (!ignoreExistingVaults) {
      const { vaults } = await getEncryptedVaults()
      const currentEncryptedVault = vaults.slice(-1)[0]?.vault
      if (currentEncryptedVault) {
        // attempt to load the vault
        const saltedKey = await deriveSymmetricKeyFromPassword(
          password,
          currentEncryptedVault.salt
        )
        let plainTextVault: SerializedKeyringData
        try {
          plainTextVault = await decryptVault<SerializedKeyringData>(
            currentEncryptedVault,
            saltedKey
          )
          this.#cachedKey = saltedKey
        } catch (err) {
          // if we weren't able to load the vault, don't unlock
          return false
        }
        // hooray! vault is loaded, import any serialized keyrings
        this.#keyrings = []
        this.#keyringMetadata = {}
        this.#privateKeys = []
        plainTextVault.keyrings.forEach((kr) => {
          this.#keyrings.push(HDKeyring.deserialize(kr))
        })
        plainTextVault.privateKeys?.forEach((pk) =>
          this.#privateKeys.push(new Wallet(pk.privateKey))
        )

        this.#keyringMetadata = {
          ...plainTextVault.metadata,
        }

        this.#hiddenAccounts = {
          ...plainTextVault.hiddenAccounts,
        }

        this.emitKeyrings()
      }
    }

    // if there's no vault or we want to force a new vault, generate a new key
    // and unlock
    if (!this.#cachedKey) {
      this.#cachedKey = await deriveSymmetricKeyFromPassword(password)
      await this.persistKeyrings()
    }

    this.#unlock()
    return true
  }

  /**
   * Lock the keyring service, deleting references to the cached vault
   * encryption key and keyrings.
   */
  async lock(): Promise<void> {
    this.lastKeyringActivity = undefined
    this.lastOutsideActivity = undefined
    this.#cachedKey = null
    this.#keyrings = []
    this.#keyringMetadata = {}
    this.#privateKeys = []
    this.emitter.emit("locked", true)
    this.emitKeyrings()
  }

  /**
   * Notifies the keyring that an outside activity occurred. Outside activities
   * are used to delay autolocking.
   */
  markOutsideActivity(): void {
    if (typeof this.lastOutsideActivity !== "undefined") {
      this.lastOutsideActivity = Date.now()
    }
  }

  // Locks the keyring if the time since last keyring or outside activity
  // exceeds preset levels.
  private async autolockIfNeeded(): Promise<void> {
    if (
      typeof this.lastKeyringActivity === "undefined" ||
      typeof this.lastOutsideActivity === "undefined"
    ) {
      // Normally both activity counters should be undefined only if the keyring
      // is locked, otherwise they should both be set; regardless, fail safe if
      // either is undefined and the keyring is unlocked.
      if (!this.locked()) {
        await this.lock()
      }

      return
    }

    const now = Date.now()
    const timeSinceLastKeyringActivity = now - this.lastKeyringActivity
    const timeSinceLastOutsideActivity = now - this.lastOutsideActivity

    if (timeSinceLastKeyringActivity >= MAX_KEYRING_IDLE_TIME) {
      this.lock()
    } else if (timeSinceLastOutsideActivity >= MAX_OUTSIDE_IDLE_TIME) {
      this.lock()
    }
  }

  // Throw if the keyring is not unlocked; if it is, update the last keyring
  // activity timestamp.
  private requireUnlocked(): void {
    if (this.locked()) {
      throw new Error("KeyringService must be unlocked.")
    }

    this.lastKeyringActivity = Date.now()
    this.markOutsideActivity()
  }

  // ///////////////////////////////////////////
  // METHODS THAT REQUIRE AN UNLOCKED SERVICE //
  // ///////////////////////////////////////////

  /**
   * Generate a new keyring
   *
   * @param type - the type of keyring to generate. Currently only supports 256-
   *        bit HD keys.
   * @returns An object containing the string ID of the new keyring and the
   *          mnemonic for the new keyring. Note that the mnemonic can only be
   *          accessed at generation time through this return value.
   */
  async generateNewKeyring(
    type: KeyringTypes,
    path?: string
  ): Promise<{ id: string; mnemonic: string[] }> {
    this.requireUnlocked()

    if (type !== KeyringTypes.mnemonicBIP39S256) {
      throw new Error(
        "KeyringService only supports generating 256-bit HD key trees"
      )
    }

    const options: { strength: number; path?: string } = { strength: 256 }

    if (path) {
      options.path = path
    }

    const newKeyring = new HDKeyring(options)

    const { mnemonic } = newKeyring.serializeSync()

    return { id: newKeyring.id, mnemonic: mnemonic.split(" ") }
  }

  /**
   * Import new internal signer
   *
   * @param signerMetadata any signer with type and metadata
   * @returns null | string - if new account was added or existing account was found then returns an address
   */
  async importKeyring(
    signerMetadata: SignerImportMetadata
  ): Promise<HexString | null> {
    this.requireUnlocked()

    try {
      let address: HexString | null

      if (signerMetadata.type === SignerSourceTypes.privateKey) {
        address = this.#importPrivateKey(signerMetadata.privateKey)
      } else {
        const { mnemonic, source, path } = signerMetadata
        address = this.#importKeyring(mnemonic, source, path)
      }

      if (!address) {
        throw new Error("address is null")
      }

      this.#hiddenAccounts[address] = false
      await this.persistKeyrings()
      this.emitter.emit("address", address)
      this.emitKeyrings()

      return address
    } catch (error) {
      logger.error("Signer import failed:", error)
      return null
    }
  }

  /**
   * Import keyring and pull the first address from that
   * keyring for system use.
   *
   * @param mnemonic - a seed phrase
   * @returns The string ID of the new keyring.
   */
  #importKeyring(
    mnemonic: string,
    source: SignerImportSource,
    path?: string
  ): string {
    const newKeyring = path
      ? new HDKeyring({ mnemonic, path })
      : new HDKeyring({ mnemonic })

    const existingKeyring = this.#keyrings.find((kr) => kr.id === newKeyring.id)
    if (existingKeyring) {
      const [address] = existingKeyring.getAddressesSync()
      return address
    }

    this.#keyrings.push(newKeyring)

    // FIXME temp solution for SDK v5
    // create a new address until we find an address for the target shard
    let address
    let found = false
    const DEFAULT_SHARD = "cyprus-1"
    while (!found) {
      address = newKeyring.addAddressesSync(1)[0]
      const shardFromAddress = getShardFromAddress(address)
      if (
        shardFromAddress !== undefined &&
        shardFromAddress === DEFAULT_SHARD
      ) {
        found = true
        break
      }
      this.#hiddenAccounts[address] = true // may want to reconsider this
    }
    if (address === undefined || address === null || address === "") {
      throw new Error(`Could not find address in given shard ${DEFAULT_SHARD}`)
    }

    // If address was previously imported as a private key then remove it
    if (this.#findPrivateKey(address)) {
      this.#removePrivateKey(address)
    }

    this.#keyringMetadata[newKeyring.id] = { source }

    return address
  }

  /**
   * Import private key with a string
   * @param privateKey - string
   * @returns string - address of imported or existing account
   */
  #importPrivateKey(privateKey: string): string {
    const newWallet = new Wallet(privateKey)
    const normalizedAddress = normalizeEVMAddress(newWallet.address)

    if (this.#findSigner(normalizedAddress)) {
      return normalizedAddress
    }

    this.#privateKeys.push(newWallet)
    this.#keyringMetadata[normalizedAddress] = {
      source: SignerImportSource.import,
    }
    return normalizedAddress
  }

  /**
   * Find a signer object associated with a given account address
   */
  #findSigner(account: HexString): InternalSignerWithType | null {
    const keyring = this.#findKeyringNew(account)
    if (keyring) {
      return {
        signer: keyring,
        type: SignerSourceTypes.keyring,
      }
    }

    const privateKey = this.#findPrivateKey(account)
    if (privateKey) {
      return {
        signer: privateKey,
        type: SignerSourceTypes.privateKey,
      }
    }

    return null
  }

  async exportPrivKey(address: string): Promise<string> {
    this.requireUnlocked()
    const signerWithType = this.#findSigner(address)
    if (!signerWithType) {
      logger.error(`Export private key for address ${address} failed`)
      return ""
    }

    if (isPrivateKey(signerWithType)) return signerWithType.signer.privateKey

    const privKey = signerWithType.signer.exportPrivateKey(
      address,
      "I solemnly swear that I am treating this private key material with great care."
    )
    return privKey ?? "Not found"
  }

  /**
   * Return the source of a given address' keyring if it exists.  If an
   * address does not have a keyring associated with it - returns null.
   */
  async getKeyringSourceForAddress(
    address: string
  ): Promise<"import" | "internal" | null> {
    try {
      const keyring = await this.#findKeyring(address)
      return this.#keyringMetadata[keyring.id].source
    } catch (e) {
      // Address is not associated with a keyring
      return null
    }
  }

  /**
   * Return an array of keyring representations that can safely be stored and
   * used outside the extension.
   */
  getKeyrings(): Keyring[] {
    this.requireUnlocked()

    return this.#keyrings.map((kr) => ({
      // TODO this type is meanlingless from the library's perspective.
      // Reconsider, or explicitly track which keyrings have been generated vs
      // imported as well as their strength
      type: KeyringTypes.mnemonicBIP39S256,
      addresses: [
        ...kr
          .getAddressesSync()
          .filter((address) => this.#hiddenAccounts[address] !== true),
      ],
      id: kr.id,
      path: kr.path,
    }))
  }

  /**
   * Returns and array of private keys representations that can safely be stored
   * and used outside the extension
   */
  getPrivateKeys(): PrivateKey[] {
    this.requireUnlocked()

    return this.#privateKeys.map((wallet) => ({
      type: KeyringTypes.singleSECP,
      addresses: [normalizeEVMAddress(wallet.address)],
      id: wallet.publicKey,
      path: null,
    }))
  }

  /**
   * Derive and return the next address for a KeyringAccountSigner representing
   * an HDKeyring.
   *
   * @param keyringAccountSigner - A KeyringAccountSigner representing the
   *        given keyring.
   */
  async deriveAddress({
    keyringID,
    shard,
  }: KeyringAccountSigner): Promise<HexString> {
    this.requireUnlocked()
    console.log("Deriving address for keyring", keyringID, "in shard", shard)
    // find the keyring using a linear search
    const keyring = this.#keyrings.find((kr) => kr.id === keyringID)
    if (!keyring) {
      throw new Error("Keyring not found.")
    }

    // const keyringAddresses = keyring.getAddressesSync()
    let found = false
    let newAddress = ""

    // If There are any hidden addresses, check those first before adding new ones.
    for (const [address, isHidden] of Object.entries(this.#hiddenAccounts)) {
      if (!isHidden) {
        continue
      }
      const shardFromAddress = getShardFromAddress(address)
      // console.log(`Address: ${address}, isHidden: ${isHidden} Shard: ${shardFromAddress}`);
      if (shardFromAddress !== undefined) {
        // Check if address is in correct shard
        if (
          shardFromAddress === shard &&
          keyring.getAddressesSync().includes(address)
        ) {
          found = true
          delete this.#hiddenAccounts[address]
          newAddress = address
          console.log("Found hidden address in shard %s %s", shard, address)
          break
        }
      }
    }

    while (!found) {
      newAddress = keyring.addAddressesSync(1)[0]
      const shardFromAddress = getShardFromAddress(newAddress)
      if (shardFromAddress !== undefined) {
        // Check if address is in correct shard
        if (shardFromAddress === shard) {
          found = true
          break
        }
      }
      this.#hiddenAccounts[newAddress] = true // may want to reconsider this
    }
    if (newAddress === undefined || newAddress === null || newAddress === "") {
      throw new Error(`Could not find address in given shard ${shard}`)
    }
    this.#hiddenAccounts[newAddress] = false

    await this.persistKeyrings()

    this.emitter.emit("address", newAddress)
    this.emitKeyrings()

    return newAddress
  }

  async hideAccount(address: HexString): Promise<void> {
    this.#hiddenAccounts[address] = true
    const keyring = await this.#findKeyring(address)
    const keyringAddresses = await keyring.getAddresses()
    if (
      keyringAddresses.every(
        (keyringAddress) => this.#hiddenAccounts[keyringAddress] === true
      )
    ) {
      keyringAddresses.forEach((keyringAddress) => {
        delete this.#hiddenAccounts[keyringAddress]
      })
      this.#removeKeyring(keyring.id)
    }
    await this.persistKeyrings()
    this.emitKeyrings()
  }

  #removeKeyring(keyringId: string): HDKeyring[] {
    const filteredKeyrings = this.#keyrings.filter(
      (keyring) => keyring.id !== keyringId
    )

    if (filteredKeyrings.length === this.#keyrings.length) {
      throw new Error(
        `Attempting to remove keyring that does not exist. id: (${keyringId})`
      )
    }
    this.#keyrings = filteredKeyrings
    return filteredKeyrings
  }

  #removePrivateKey(address: HexString): Wallet[] {
    const filteredPrivateKeys = this.#privateKeys.filter(
      (wallet) => !sameEVMAddress(wallet.address, address)
    )

    if (filteredPrivateKeys.length === this.#privateKeys.length) {
      throw new Error(
        `Attempting to remove wallet that does not exist. Address: (${address})`
      )
    }

    this.#privateKeys = filteredPrivateKeys
    delete this.#keyringMetadata[normalizeEVMAddress(address)]

    return filteredPrivateKeys
  }

  /**
   * Find keyring associated with an account.
   *
   * @param account - the account address desired to search the keyring for.
   * @returns HD keyring object
   */
  #findKeyringNew(account: HexString): HDKeyring | null {
    const keyring = this.#keyrings.find((kr) =>
      kr.getAddressesSync().includes(normalizeEVMAddress(account))
    )

    return keyring ?? null
  }

  /**
   * Find keyring associated with an account.
   *
   * @param account - the account desired to search the keyring for.
   */
  async #findKeyring(account: HexString): Promise<HDKeyring> {
    const keyring = this.#keyrings.find((kr) =>
      kr.getAddressesSync().includes(normalizeEVMAddress(account))
    )
    if (!keyring) {
      throw new Error("Address keyring not found.")
    }
    return keyring
  }

  /**
   * Find a wallet imported with a private key
   *
   * @param account - the account address desired to search the wallet for.
   * @returns Ether's Wallet object
   */
  #findPrivateKey(account: HexString): Wallet | null {
    const privateKey = this.#privateKeys.find((item) =>
      sameEVMAddress(item.address, account)
    )

    return privateKey ?? null
  }

  /**
   * Sign a transaction.
   *
   * @param addressOnNetwork - the desired account address on network to sign the transaction
   * @param txRequest -
   */
  async signTransaction(
    addressOnNetwork: AddressOnNetwork,
    txRequest: TransactionRequestWithNonce
  ): Promise<SignedTransaction> {
    this.requireUnlocked()

    const { address: account, network } = addressOnNetwork

    const signerWithType = this.#findSigner(account)
    if (!signerWithType)
      throw new Error(
        `Signing transaction failed. Signer for address ${account} was not found.`
      )

    const ethersTxRequest = ethersTransactionFromTransactionRequest(txRequest)

    const signedRawTransactionString = isPrivateKey(signerWithType)
      ? await signerWithType.signer.signTransaction(ethersTxRequest) // Using Wallet for private key sign
      : await signerWithType.signer.signTransaction(account, ethersTxRequest) // Using HDKeyring for deterministic wallet sign

    const parsedTx = parseRawTransaction(signedRawTransactionString)
    const signedTransaction = parseAndValidateSignedTransaction(
      parsedTx,
      network
    )

    return signedTransaction
  }
  /**
   * Sign typed data based on EIP-712 with the usage of eth_signTypedData_v4 method,
   * more information about the EIP can be found at https://eips.ethereum.org/EIPS/eip-712
   *
   * @param typedData - the data to be signed
   * @param account - signers account address
   */

  async signTypedData({
    typedData,
    account,
  }: {
    typedData: EIP712TypedData
    account: HexString
  }): Promise<string> {
    this.requireUnlocked()
    const { domain, types, message } = typedData
    // find the keyring using a linear search
    const keyring = await this.#findKeyring(account)
    // When signing we should not include EIP712Domain type
    const { EIP712Domain, ...typesForSigning } = types
    try {
      const signature = await keyring.signTypedData(
        account,
        domain,
        typesForSigning,
        message
      )

      return signature
    } catch (error) {
      throw new Error("Signing data failed")
    }
  }

  /**
   * Sign data based on EIP-191 with the usage of personal_sign method,
   * more information about the EIP can be found at https://eips.ethereum.org/EIPS/eip-191
   *
   * @param signingData - the data to be signed
   * @param account - signers account address
   */

  async personalSign({
    signingData,
    account,
  }: {
    signingData: HexString
    account: HexString
  }): Promise<string> {
    this.requireUnlocked()

    // find the keyring using a linear search
    const keyring = await this.#findKeyring(account)
    try {
      const signature = await keyring.signMessageBytes(
        account,
        arrayify(signingData)
      )

      return signature
    } catch (error) {
      throw new Error("Signing data failed")
    }
  }

  // //////////////////
  // PRIVATE METHODS //
  // //////////////////

  private emitKeyrings() {
    if (this.locked()) {
      this.emitter.emit("keyrings", {
        privateKeys: [],
        keyrings: [],
        keyringMetadata: {},
      })
    } else {
      const keyrings = this.getKeyrings()
      const privateKeys = this.getPrivateKeys()
      this.emitter.emit("keyrings", {
        privateKeys,
        keyrings,
        keyringMetadata: { ...this.#keyringMetadata },
      })
    }
  }

  /**
   * Serialize, encrypt, and persist all HDKeyrings.
   */
  private async persistKeyrings() {
    this.requireUnlocked()

    // This if guard will always pass due to requireUnlocked, but statically
    // prove it to TypeScript.
    if (this.#cachedKey !== null) {
      const serializedKeyrings = this.#keyrings.map((kr) => kr.serializeSync())
      const serializedPrivateKeys: SerializedPrivateKey[] =
        this.#privateKeys.map((wallet) => ({
          version: 1,
          id: wallet.publicKey,
          privateKey: wallet.privateKey,
        }))

      const hiddenAccounts = { ...this.#hiddenAccounts }
      const keyringMetadata = { ...this.#keyringMetadata }
      serializedKeyrings.sort((a, b) => (a.id > b.id ? 1 : -1))
      const vault = await encryptVault(
        {
          keyrings: serializedKeyrings,
          privateKeys: serializedPrivateKeys,
          metadata: keyringMetadata,
          hiddenAccounts,
        },
        this.#cachedKey
      )
      await writeLatestEncryptedVault(vault)
    }
  }
}
