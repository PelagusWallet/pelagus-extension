import { AddressLike, Mnemonic, QuaiHDWallet, Zone } from "quais"
import { WalletManager } from "./wallet-manager"
import { sameQuaiAddress } from "../../lib/utils"

export default class QuaiHDWalletManager extends WalletManager {
  // -------------------------- public methods --------------------------
  public async add(
    mnemonic: string
    // source: SignerImportSource
  ): Promise<string> {
    const mnemonicFromPhrase = Mnemonic.fromPhrase(mnemonic)
    const newQuaiHDWallet = QuaiHDWallet.fromMnemonic(mnemonicFromPhrase)

    const existingQuaiHDWallet = await this.get(newQuaiHDWallet.xPub)

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

  // -------------------------- private methods --------------------------
  private async get(xPub: string): Promise<QuaiHDWallet | undefined> {
    const { quaiHDWallets } = await this.vaultManager.get()

    const deserializedHDWallets: QuaiHDWallet[] = await Promise.all(
      quaiHDWallets.map((HDWallet) => QuaiHDWallet.deserialize(HDWallet))
    )

    return deserializedHDWallets.find(
      (HDWallet: QuaiHDWallet) => HDWallet.xPub === xPub
    )
  }
}
