import { AddressLike, Mnemonic, QuaiHDWallet, Zone } from "quais"
import logger from "../../lib/logger"
import { sameQuaiAddress } from "../../lib/utils"
import { WalletManager } from "./wallet-manager"

export default class QuaiHDWalletManager {
  public readonly quaiHDWalletAccountIndex: number = 0

  constructor(private walletManager: WalletManager) {}

  // -------------------------- public methods --------------------------
  public async add(mnemonic: string): Promise<string> {
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

    return address
  }

  public async get(xPub: string): Promise<QuaiHDWallet | undefined> {
    const { quaiHDWallets } = await this.walletManager.vaultManager.get()

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
    const { quaiHDWallets } = await this.walletManager.vaultManager.get()

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
        delete this.walletManager.hiddenAccounts[walletAddress]
      })

    const filteredQuaiHDWallets = this.walletManager.quaiHDWallets.filter(
      (HDWallet) => HDWallet.id !== foundedHDWallet.xPub
    )

    if (
      filteredQuaiHDWallets.length === this.walletManager.quaiHDWallets.length
    ) {
      throw new Error(
        `Attempting to remove Quai HDWallet that does not exist. xPub: (${foundedHDWallet.xPub})`
      )
    }
    this.walletManager.quaiHDWallets = filteredQuaiHDWallets

    await this.walletManager.vaultManager.delete({
      hdWalletId: foundedHDWallet.serialize().phrase,
    })
  }
}
