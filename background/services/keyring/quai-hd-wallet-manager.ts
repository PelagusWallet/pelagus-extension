import { AddressLike, Mnemonic, QuaiHDWallet, Zone } from "quais"
import { WalletManager } from "./wallet-manager"
import { sameQuaiAddress } from "../../lib/utils"
import logger from "../../lib/logger"
import { generateRandomBytes } from "./utils"

export default class QuaiHDWalletManager extends WalletManager {
  // -------------------------- public methods --------------------------
  public async add(
    mnemonic: string
    // source: SignerImportSource
  ): Promise<string> {
    const mnemonicFromPhrase = Mnemonic.fromPhrase(mnemonic)
    const newQuaiHDWallet = QuaiHDWallet.fromMnemonic(mnemonicFromPhrase)

    const existingQuaiHDWallet = await this.getByAddress(newQuaiHDWallet.xPub)

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

    // const serializedQuaiHDWallet = newQuaiHDWallet.serialize()
    //
    // // If address was previously imported as a private key then remove it
    // if (await this.findWalletByAddress(address)) {
    //   await this.removeWallet(address)
    // }
    //
    // this.quaiHDWallets = [
    //   ...this.quaiHDWallets,
    //   {
    //     type: KeyringTypes.mnemonicBIP39S256,
    //     addresses: [
    //       ...newQuaiHDWallet
    //         .getAddressesForAccount(this.quaiHDWalletAccountIndex)
    //         .filter(
    //           (quaiHDWallet) => !this.hiddenAccounts[quaiHDWallet.address]
    //         )
    //         .map((quaiHDWallet) => quaiHDWallet.address),
    //     ],
    //     id: newQuaiHDWallet.xPub,
    //     path: null,
    //   },
    // ]
    //
    // this.keyringMetadata[newQuaiHDWallet.xPub] = {
    //   source,
    // }
    // await this.vaultManager.add(
    //   {
    //     quaiHDWallets: [serializedQuaiHDWallet],
    //     metadata: { [newQuaiHDWallet.xPub]: { source } },
    //   },
    //   {}
    // )

    return address
  }

  public async get(xPub: string): Promise<QuaiHDWallet | undefined> {
    const { quaiHDWallets } = await this.vaultManager.get()

    const deserializedHDWallets: QuaiHDWallet[] = await Promise.all(
      quaiHDWallets.map((HDWallet) => QuaiHDWallet.deserialize(HDWallet))
    )

    return deserializedHDWallets.find(
      (HDWallet: QuaiHDWallet) => HDWallet.xPub === xPub
    )
  }

  public async getByAddress(
    address: AddressLike
  ): Promise<QuaiHDWallet | undefined> {
    const { quaiHDWallets } = await this.vaultManager.get()

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

  async deleteByAddress(address: string): Promise<void> {
    const foundedHDWallet = await this.getByAddress(address)
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

    await this.vaultManager.delete({
      hdWalletId: foundedHDWallet.serialize().phrase,
    })

    // this.emitKeyrings()
  }

  public async createMnemonic(): Promise<string> {
    const randomBytes = generateRandomBytes(24)
    const { phrase } = Mnemonic.fromEntropy(randomBytes)
    return phrase
  }
  // -------------------------- private methods --------------------------
}
