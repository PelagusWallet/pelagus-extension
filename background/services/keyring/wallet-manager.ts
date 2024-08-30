import { AddressLike, getAddress, Mnemonic, QuaiHDWallet, Wallet } from "quais"
import {
  HiddenAccounts,
  InternalSignerWithType,
  Keyring,
  KeyringAccountSigner,
  KeyringMetadata,
  PrivateKey,
  PublicWalletsData,
  SignerImportMetadata,
  SignerImportSource,
  SignerSourceTypes,
} from "./types"
import { IVaultManager } from "./vault-manager"
import { KeyringTypes } from "../../types"
import PrivateKeyManager from "./private-key-manager"
import QuaiHDWalletManager from "./quai-hd-wallet-manager"
import { isGoldenAgeQuaiAddress } from "../../utils/addresses"
import logger from "../../lib/logger"
import { SignerType } from "../signing"
import { generateRandomBytes } from "./utils"
import { sameQuaiAddress } from "../../lib/utils"
import { applicationError } from "../../constants/errorsCause"

export default class WalletManager {
  public privateKeys: PrivateKey[] = []

  public quaiHDWallets: Keyring[] = []

  public hiddenAccounts: HiddenAccounts = {}

  public keyringMetadata: KeyringMetadata = {}

  private privateKeyManager: PrivateKeyManager

  private quaiHDWalletManager: QuaiHDWalletManager

  // -------------------------- public methods --------------------------
  constructor(public vault: IVaultManager) {
    this.privateKeyManager = new PrivateKeyManager(vault)
    this.quaiHDWalletManager = new QuaiHDWalletManager(vault)
  }

  public async initializeState(): Promise<void> {
    const { wallets, quaiHDWallets, metadata, hiddenAccounts } =
      await this.vault.get()

    this.privateKeys = wallets.map((serializedWallet) => {
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
    this.quaiHDWallets = deserializedHDWallets.map((quaiHDWallet) => {
      return {
        type: KeyringTypes.mnemonicBIP39S256,
        addresses: [
          ...quaiHDWallet
            .getAddressesForAccount(
              this.quaiHDWalletManager.quaiHDWalletAccountIndex
            )
            .filter(({ address }) => !this.hiddenAccounts[address])
            .map(({ address }) => address),
        ],
        id: quaiHDWallet.xPub,
        path: null,
      }
    })

    this.keyringMetadata = metadata
    this.hiddenAccounts = hiddenAccounts
  }

  public clearState(): void {
    this.privateKeys = []
    this.quaiHDWallets = []
    this.hiddenAccounts = {}
    this.keyringMetadata = {}
    this.vault.clearSaltedKey()
  }

  public getState(): PublicWalletsData {
    return {
      wallets: this.privateKeys,
      quaiHDWallets: this.quaiHDWallets,
      keyringMetadata: this.keyringMetadata,
    }
  }

  public async importSigner(
    signerMetadata: SignerImportMetadata
  ): Promise<string> {
    switch (signerMetadata.type) {
      case SignerSourceTypes.privateKey:
        return this.importPrivateKey(signerMetadata.privateKey)
      case SignerSourceTypes.keyring:
        return this.importQuaiHDWallet(
          signerMetadata.mnemonic,
          signerMetadata.source
        )
      default:
        throw new Error(`Unsupported signer type`)
    }
  }

  public async deleteSigner(
    address: string,
    signerType: SignerType
  ): Promise<void> {
    switch (signerType) {
      case "private-key":
        return this.deletePrivateKey(address)
      case "keyring":
        return this.deleteQuaiHDWallet(address)
      default:
        throw new Error(`Unsupported signer type`)
    }
  }

  public async findSigner(
    address: AddressLike
  ): Promise<InternalSignerWithType | null> {
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

  public async getSignerSource(
    address: string
  ): Promise<SignerImportSource | null> {
    const foundedKeyring = [...this.quaiHDWallets, ...this.privateKeys].find(
      (keyring) => keyring.addresses.includes(address)
    )
    if (!foundedKeyring) {
      logger.error("Associated signer with provided address is not found.")
      return null
    }

    return this.keyringMetadata[foundedKeyring.id].source
  }

  public async generateQuaiHDWalletMnemonic(): Promise<{
    id: string
    mnemonic: string[]
  }> {
    const { phrase } = Mnemonic.fromEntropy(generateRandomBytes(24))
    const mnemonic = phrase.split(" ")

    const keyringIdToVerify = this.quaiHDWallets.length.toString()
    return { id: keyringIdToVerify, mnemonic }
  }

  public async deriveQuaiHDWalletAddress({
    keyringID,
    zone,
  }: KeyringAccountSigner): Promise<string> {
    const { address, quaiHDWallet } =
      await this.quaiHDWalletManager.deriveAddress(keyringID, zone)

    const existingPrivateKey = await this.privateKeyManager.getByAddress(
      address
    )
    if (existingPrivateKey) {
      await this.deletePrivateKey(address)
    }

    this.quaiHDWallets = this.quaiHDWallets.map((HDWallet) => {
      return HDWallet?.id === quaiHDWallet.xPub
        ? {
            ...HDWallet,
            addresses: [...HDWallet.addresses, address],
          }
        : HDWallet
    })

    await this.vault.update({
      quaiHDWallets: [quaiHDWallet.serialize()],
    })

    return address
  }

  // -------------------------- private methods --------------------------
  private async importPrivateKey(privateKey: string): Promise<string> {
    const { address, publicKey } = await this.privateKeyManager.add(privateKey)
    if (!isGoldenAgeQuaiAddress(address)) {
      throw new Error("Not a Golden Age address", { cause: applicationError })
    }

    if (await this.findSigner(address)) {
      throw new Error("Private key already in use", { cause: applicationError })
    }

    this.privateKeys = [
      ...this.privateKeys,
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

    await this.vault.add(
      {
        wallets: [
          {
            version: 1,
            id: publicKey,
            privateKey,
          },
        ],
        metadata: { [publicKey]: { source: SignerImportSource.import } },
      },
      {}
    )

    return address
  }

  private async importQuaiHDWallet(
    mnemonic: string,
    source: SignerImportSource
  ): Promise<string> {
    const { address, quaiHDWallet } = await this.quaiHDWalletManager.add(
      mnemonic
    )

    const existingPrivateKey = await this.privateKeyManager.getByAddress(
      address
    )
    if (existingPrivateKey) {
      await this.deletePrivateKey(address)
    }

    this.quaiHDWallets = [
      ...this.quaiHDWallets,
      {
        type: KeyringTypes.mnemonicBIP39S256,
        addresses: [address],
        id: quaiHDWallet.xPub,
        path: null,
      },
    ]
    this.keyringMetadata[quaiHDWallet.xPub] = {
      source,
    }

    const serializedQuaiHDWallet = quaiHDWallet.serialize()
    await this.vault.add(
      {
        quaiHDWallets: [serializedQuaiHDWallet],
        metadata: { [quaiHDWallet.xPub]: { source } },
      },
      {}
    )

    return address
  }

  private async deletePrivateKey(address: string): Promise<void> {
    let targetWalletPublicKey = ""
    const filteredPrivateKeys = this.privateKeys.filter((wallet) => {
      if (!sameQuaiAddress(wallet.addresses[0], address)) return true

      targetWalletPublicKey = wallet.id
      return false
    })

    if (filteredPrivateKeys.length === this.privateKeys.length) {
      throw new Error(`Attempting to remove wallet that does not exist`)
    }

    this.privateKeys = filteredPrivateKeys
    delete this.keyringMetadata[targetWalletPublicKey]
    await this.vault.delete({
      metadataKey: targetWalletPublicKey,
    })

    const { wallets } = await this.vault.get()
    const walletsWithoutTargetWallet = wallets.filter(
      (serializedWallet) => serializedWallet.id !== targetWalletPublicKey
    )
    await this.vault.add(
      { wallets: walletsWithoutTargetWallet },
      { overwriteWallets: true }
    )
  }

  private async deleteQuaiHDWallet(address: string): Promise<void> {
    const foundedHDWallet = await this.quaiHDWalletManager.getByAddress(address)
    if (!foundedHDWallet) {
      logger.error("QuaiHDWallet associated with an address is not found")
      return
    }

    foundedHDWallet
      .getAddressesForAccount(this.quaiHDWalletManager.quaiHDWalletAccountIndex)
      .forEach(({ address: walletAddress }) => {
        delete this.hiddenAccounts[walletAddress]
      })

    this.quaiHDWallets = this.quaiHDWallets.filter(
      (HDWallet) => HDWallet.id !== foundedHDWallet.xPub
    )

    await this.vault.delete({
      hdWalletId: foundedHDWallet.serialize().phrase,
    })
  }
}
