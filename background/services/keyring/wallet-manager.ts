import { AddressLike, getAddress, Mnemonic, QuaiHDWallet, Wallet } from "quais"

import {
  InternalSignerWithType,
  Keyring,
  KeyringAccountSigner,
  PrivateKey,
  SignerImportMetadata,
  SignerImportSource,
  SignerSourceTypes,
} from "./types"
import { IVaultManager } from "./vault-manager"
import { HexString, KeyringTypes } from "../../types"
import PrivateKeyManager from "./private-key-manager"
import QuaiHDWalletManager from "./quai-hd-wallet-manager"
import { isGoldenAgeQuaiAddress } from "../../utils/addresses"
import { sameQuaiAddress } from "../../lib/utils"
import logger from "../../lib/logger"

export type KeyringMetadata = {
  [keyringId: string]: { source: SignerImportSource }
}

export type HiddenAccounts = { [address: HexString]: boolean }

export type PublicWalletsData = {
  wallets: PrivateKey[]
  quaiHDWallets: Keyring[]
  keyringMetadata: {
    [keyringId: string]: { source: SignerImportSource }
  }
}

export interface IWalletManager {
  init(password: string): Promise<void>
  clearState(): void
  getStateData(): PublicWalletsData
  import(signerMetadata: SignerImportMetadata): Promise<string>
  findSigner(address: AddressLike): Promise<InternalSignerWithType | null>
  getSource(address: string): Promise<SignerImportSource | null>
  createQuaiHDWalletMnemonic(): Promise<{ id: string; mnemonic: string[] }>
  deriveQuaiHDWalletAddress({
    keyringID,
    zone,
  }: KeyringAccountSigner): Promise<string>
}

export class WalletManager implements IWalletManager {
  private privateKeyManager: PrivateKeyManager

  private quaiHDWalletManager: QuaiHDWalletManager

  public privateKeys: PrivateKey[] = []

  public quaiHDWallets: Keyring[] = []

  public hiddenAccounts: HiddenAccounts = {}

  public keyringMetadata: KeyringMetadata = {}

  public readonly quaiHDWalletAccountIndex: number = 0

  constructor(protected vaultManager: IVaultManager) {
    this.privateKeyManager = new PrivateKeyManager(this.vaultManager)
    this.quaiHDWalletManager = new QuaiHDWalletManager(this.vaultManager)
  }

  // -------------------------- public methods --------------------------
  public async init(password: string): Promise<void> {
    await this.vaultManager.initializeWithPassword(password)
    await this.initializeState()
  }

  public clearState(): void {
    this.vaultManager.clearSymmetricKey()

    this.privateKeys = []
    this.quaiHDWallets = []
    this.hiddenAccounts = {}
    this.keyringMetadata = {}
  }

  public getStateData(): PublicWalletsData {
    return {
      wallets: this.privateKeys,
      quaiHDWallets: this.quaiHDWallets,
      keyringMetadata: this.keyringMetadata,
    }
  }

  public async import(signerMetadata: SignerImportMetadata): Promise<string> {
    let address: string
    const { type } = signerMetadata

    switch (type) {
      case SignerSourceTypes.privateKey:
        address = await this.importPrivateKey(signerMetadata.privateKey)
        break
      case SignerSourceTypes.keyring:
        address = await this.importQuaiHDWallet(
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

    return address
  }

  public async importPrivateKey(privateKey: string): Promise<string> {
    const address = await this.privateKeyManager.add(privateKey)

    if (!isGoldenAgeQuaiAddress(address)) {
      throw new Error("Not golden age address")
    }

    if (await this.findSigner(address)) {
      throw new Error("Private key already exists")
    }

    // TODO think about public key as id
    const serializedWallet = {
      version: 1,
      id: address,
      privateKey,
    }

    this.privateKeys = [
      ...this.privateKeys,
      {
        type: KeyringTypes.singleSECP,
        addresses: [address],
        id: address,
        path: null,
      },
    ]

    this.keyringMetadata[address] = {
      source: SignerImportSource.import,
    }

    await this.vaultManager.add(
      {
        wallets: [serializedWallet],
        metadata: { [address]: { source: SignerImportSource.import } },
      },
      {}
    )

    return address
  }

  async importQuaiHDWallet(
    mnemonic: string,
    source: SignerImportSource
  ): Promise<string> {
    const address = await this.quaiHDWalletManager.add(mnemonic)

    const mnemonicFromPhrase = Mnemonic.fromPhrase(mnemonic)
    const newQuaiHDWallet = QuaiHDWallet.fromMnemonic(mnemonicFromPhrase)

    const serializedQuaiHDWallet = newQuaiHDWallet.serialize()

    // If address was previously imported as a private key then remove it
    const existingAddress = await this.findSigner(address)

    if (existingAddress) {
      let targetWalletPublicKey = ""
      const filteredPrivateKeys = this.privateKeys.filter((wallet) => {
        if (!sameQuaiAddress(wallet.addresses[0], address)) return true

        targetWalletPublicKey = wallet.id
        return false
      })

      if (filteredPrivateKeys.length === this.privateKeys.length) {
        throw new Error(
          `Attempting to remove wallet that does not exist. Address: (${address})`
        )
      }

      this.privateKeys = filteredPrivateKeys
      delete this.keyringMetadata[targetWalletPublicKey]

      const { wallets } = await this.vaultManager.get()
      const walletsWithoutTargetWallet = wallets.filter(
        (serializedWallet) => serializedWallet.id !== targetWalletPublicKey
      )

      await this.vaultManager.add(
        { wallets: walletsWithoutTargetWallet },
        { overwriteWallets: true }
      )
      await this.vaultManager.delete({ metadataKey: targetWalletPublicKey })
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
    await this.vaultManager.add(
      {
        quaiHDWallets: [serializedQuaiHDWallet],
        metadata: { [newQuaiHDWallet.xPub]: { source } },
      },
      {}
    )

    return address
  }

  public async findSigner(
    address: AddressLike
  ): Promise<InternalSignerWithType | null> {
    // we format the address because it can also come from a request from outside the wallet,
    // which may be in the wrong format
    const formatedAddress = getAddress(address as string)

    const quaiHDWallet = await this.quaiHDWalletManager.getByAddress(address)
    if (quaiHDWallet) {
      return {
        signer: quaiHDWallet,
        address: formatedAddress,
        type: SignerSourceTypes.keyring,
      }
    }

    const privateKey = await this.privateKeyManager.getByAddress(address)
    if (privateKey) {
      return {
        signer: privateKey,
        address: formatedAddress,
        type: SignerSourceTypes.privateKey,
      }
    }

    return null
  }

  public async getSource(address: string): Promise<SignerImportSource | null> {
    const foundedKeyring = [...this.quaiHDWallets, ...this.privateKeys].find(
      (keyring) => keyring.addresses.includes(address)
    )
    if (!foundedKeyring) {
      logger.error("foundedKeyring associated with an address is not found.")
      return null
    }

    return this.keyringMetadata[foundedKeyring.id].source
  }

  public async createQuaiHDWalletMnemonic(): Promise<{
    id: string
    mnemonic: string[]
  }> {
    // used only for redux, so we can use quaiHDWallets length as id
    const keyringIdToVerify = this.quaiHDWallets.length.toString()
    const phrase = await this.quaiHDWalletManager.createMnemonic()
    return { id: keyringIdToVerify, mnemonic: phrase.split(" ") }
  }

  public async deriveQuaiHDWalletAddress({
    keyringID,
    zone,
  }: KeyringAccountSigner): Promise<string> {
    const quaiHDWallet = await this.quaiHDWalletManager.get(keyringID)
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

    await this.vaultManager.update({
      quaiHDWallets: [quaiHDWallet.serialize()],
    })

    return address
  }

  // -------------------------- private methods --------------------------
  private async initializeState(): Promise<void> {
    const { wallets, quaiHDWallets, metadata, hiddenAccounts } =
      await this.vaultManager.get()

    const publicWalletsData: PrivateKey[] = wallets.map((serializedWallet) => {
      const wallet = new Wallet(serializedWallet.privateKey)

      return {
        type: KeyringTypes.singleSECP,
        addresses: [wallet.address],
        id: wallet.signingKey.publicKey,
        path: null,
      }
    })

    const deserializedHDWallets = await Promise.all(
      quaiHDWallets.map((quaiHDWallet) =>
        QuaiHDWallet.deserialize(quaiHDWallet)
      )
    )
    const publicQuaiHDWalletsData: Keyring[] = deserializedHDWallets.map(
      (quaiHDWallet) => {
        return {
          type: KeyringTypes.mnemonicBIP39S256,
          addresses: [
            ...quaiHDWallet
              .getAddressesForAccount(this.quaiHDWalletAccountIndex)
              .filter(({ address }) => !this.hiddenAccounts[address])
              .map(({ address }) => address),
          ],
          id: quaiHDWallet.xPub,
          path: null,
        }
      }
    )

    this.privateKeys = publicWalletsData
    this.quaiHDWallets = publicQuaiHDWalletsData
    this.keyringMetadata = metadata
    this.hiddenAccounts = hiddenAccounts
  }
}
