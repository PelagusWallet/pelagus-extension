import { AddressLike, Wallet } from "quais"
import { sameQuaiAddress } from "../../lib/utils"
import { WalletManager } from "./wallet-manager"

export default class PrivateKeyManager {
  constructor(private walletManager: WalletManager) {}

  public async add(privateKey: string): Promise<string> {
    const newWallet = new Wallet(privateKey)
    const { address } = newWallet
    // const { publicKey } = new SigningKey(newWallet.privateKey)

    return address
  }

  public async getByAddress(address: AddressLike): Promise<Wallet | undefined> {
    const { wallets } = await this.walletManager.vaultManager.get()

    return wallets
      .map((serializedWallet) => new Wallet(serializedWallet.privateKey))
      .find((deserializedWallet) =>
        sameQuaiAddress(deserializedWallet.address, address as string)
      )
  }

  async deleteByAddress(address: string): Promise<void> {
    let targetWalletPublicKey = ""
    const filteredPrivateKeys = this.walletManager.privateKeys.filter(
      (wallet) => {
        if (!sameQuaiAddress(wallet.addresses[0], address)) return true

        targetWalletPublicKey = wallet.id
        return false
      }
    )

    if (filteredPrivateKeys.length === this.walletManager.privateKeys.length) {
      throw new Error(
        `Attempting to remove wallet that does not exist. Address: (${address})`
      )
    }

    this.walletManager.privateKeys = filteredPrivateKeys
    delete this.walletManager.keyringMetadata[targetWalletPublicKey]

    const { wallets } = await this.walletManager.vaultManager.get()
    const walletsWithoutTargetWallet = wallets.filter(
      (serializedWallet) => serializedWallet.id !== targetWalletPublicKey
    )

    await this.walletManager.vaultManager.add(
      { wallets: walletsWithoutTargetWallet },
      { overwriteWallets: true }
    )
    await this.walletManager.vaultManager.delete({
      metadataKey: targetWalletPublicKey,
    })
  }
}
