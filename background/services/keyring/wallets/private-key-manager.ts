import { AddressLike, SigningKey, Wallet } from "quais"
import { AddressWithPublicKey } from "../types"
import { IVaultManager } from "../vault-manager"
import { sameQuaiAddress } from "../../../lib/utils"

export interface IPrivateKeyManager {
  add(privateKey: string): Promise<AddressWithPublicKey>
  getByAddress(address: AddressLike): Promise<Wallet | undefined>
}

export default class PrivateKeyManager implements IPrivateKeyManager {
  constructor(private vaultManager: IVaultManager) {}

  public async add(privateKeyParam: string): Promise<AddressWithPublicKey> {
    const { address, privateKey } = new Wallet(privateKeyParam)
    const { publicKey } = new SigningKey(privateKey)

    return { address, publicKey }
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
