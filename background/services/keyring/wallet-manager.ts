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
import { generateMnemonic } from "./utils"

export class WalletManager {
  public privateKeys: PrivateKey[] = []

  public quaiHDWallets: Keyring[] = []

  public hiddenAccounts: HiddenAccounts = {}

  public keyringMetadata: KeyringMetadata = {}

  private privateKeyManager: PrivateKeyManager

  private quaiHDWalletManager: QuaiHDWalletManager

  // -------------------------- public methods --------------------------
  constructor(public vaultManager: IVaultManager) {
    this.privateKeyManager = new PrivateKeyManager(this)
    this.quaiHDWalletManager = new QuaiHDWalletManager(this)
  }

  public async init(password: string): Promise<void> {
    await this.vaultManager.initializeWithPassword(password)
    await this.initializeState()
  }

  public clearState(): void {
    this.privateKeys = []
    this.quaiHDWallets = []
    this.hiddenAccounts = {}
    this.keyringMetadata = {}
    this.vaultManager.clearSymmetricKey()
  }

  public getStateData(): PublicWalletsData {
    return {
      wallets: this.privateKeys,
      quaiHDWallets: this.quaiHDWallets,
      keyringMetadata: this.keyringMetadata,
    }
  }

  public async import(signerMetadata: SignerImportMetadata): Promise<string> {
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

  async deleteAccount(address: string, signerType: SignerType): Promise<void> {
    switch (signerType) {
      case "private-key":
        await this.privateKeyManager.deleteByAddress(address)
        break
      case "keyring":
        await this.quaiHDWalletManager.deleteByAddress(address)
        break
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
    const mnemonic = generateMnemonic().split(" ")
    const keyringIdToVerify = this.quaiHDWallets.length.toString()
    return { id: keyringIdToVerify, mnemonic }
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
      this.quaiHDWalletManager.quaiHDWalletAccountIndex,
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
              .getAddressesForAccount(
                this.quaiHDWalletManager.quaiHDWalletAccountIndex
              )
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

  private async importPrivateKey(privateKey: string): Promise<string> {
    const address = await this.privateKeyManager.add(privateKey)
    if (!isGoldenAgeQuaiAddress(address)) {
      throw new Error("Not golden age address")
    }

    if (await this.findSigner(address)) {
      throw new Error("Private key already exists")
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
        wallets: [
          {
            version: 1,
            id: address,
            privateKey,
          },
        ],
        metadata: { [address]: { source: SignerImportSource.import } },
      },
      {}
    )

    return address
  }

  private async importQuaiHDWallet(
    mnemonic: string,
    source: SignerImportSource
  ): Promise<string> {
    const address = await this.quaiHDWalletManager.add(mnemonic)

    const mnemonicFromPhrase = Mnemonic.fromPhrase(mnemonic)
    const newQuaiHDWallet = QuaiHDWallet.fromMnemonic(mnemonicFromPhrase)

    const existingQuaiHDWallet = await this.quaiHDWalletManager.getByAddress(
      address
    )
    if (existingQuaiHDWallet) return address

    const existingPrivateKey = await this.privateKeyManager.getByAddress(
      address
    )
    if (existingPrivateKey)
      await this.privateKeyManager.deleteByAddress(address)

    const serializedQuaiHDWallet = newQuaiHDWallet.serialize()

    this.quaiHDWallets = [
      ...this.quaiHDWallets,
      {
        type: KeyringTypes.mnemonicBIP39S256,
        addresses: [
          ...newQuaiHDWallet
            .getAddressesForAccount(
              this.quaiHDWalletManager.quaiHDWalletAccountIndex
            )
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
}
