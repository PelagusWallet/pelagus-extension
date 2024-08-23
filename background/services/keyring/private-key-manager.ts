import { AddressLike, SigningKey, Wallet } from "quais"

import { WalletManager } from "./wallet-manager"
import { sameQuaiAddress } from "../../lib/utils"

export default class PrivateKeyManager extends WalletManager {
  public async add(privateKey: string): Promise<string> {
    const newWallet = new Wallet(privateKey)
    const { address } = newWallet

    const { publicKey } = new SigningKey(newWallet.privateKey)

    return address
  }

  public async getByAddress(address: AddressLike): Promise<Wallet | undefined> {
    const { wallets } = await this.vaultManager.get()

    return wallets
      .map((serializedWallet) => new Wallet(serializedWallet.privateKey))
      .find((deserializedWallet) =>
        sameQuaiAddress(deserializedWallet.address, address as string)
      )
  }
}
