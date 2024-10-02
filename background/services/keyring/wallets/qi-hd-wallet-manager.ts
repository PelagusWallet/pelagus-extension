import { AddressLike, Mnemonic, QiHDWallet, Zone } from "quais"

import { IVaultManager } from "../vault-manager"
import { AddressWithQiHDWallet } from "../types"
import { sameQuaiAddress } from "../../../lib/utils"
import { applicationError } from "../../../constants/errorsCause"
import { generateRandomBytes } from "../utils"

export interface IQiHDWalletManager {
  create(): Promise<AddressWithQiHDWallet>
  getByAddress(address: AddressLike): Promise<QiHDWallet | undefined>
  deriveAddress(xPub: string, zone: Zone): Promise<AddressWithQiHDWallet>
}

export default class QiHDWalletManager implements IQiHDWalletManager {
  public readonly qiHDWalletAccountIndex: number = 0

  constructor(private vaultManager: IVaultManager) {}

  // -------------------------- public methods --------------------------
  public async create(): Promise<AddressWithQiHDWallet> {
    const { phrase } = Mnemonic.fromEntropy(generateRandomBytes(24))
    const mnemonic = Mnemonic.fromPhrase(phrase)
    const qiHDWallet = QiHDWallet.fromMnemonic(mnemonic)

    const existingQiHDWallet = await this.getByXPub(qiHDWallet.xPub)
    if (existingQiHDWallet) {
      throw new Error("Qi HD Wallet already in use", {
        cause: applicationError,
      })
    }

    const { address } = await qiHDWallet.getNextAddress(
      this.qiHDWalletAccountIndex,
      Zone.Cyprus1
    )

    return { address, qiHDWallet }
  }

  public async getByAddress(
    address: AddressLike
  ): Promise<QiHDWallet | undefined> {
    const { qiHDWallets } = await this.vaultManager.get()

    const deserializedHDWallets: QiHDWallet[] = await Promise.all(
      qiHDWallets.map((qiHDWallet) => QiHDWallet.deserialize(qiHDWallet))
    )

    return deserializedHDWallets.find((HDWallet) =>
      HDWallet.getAddressesForAccount(this.qiHDWalletAccountIndex).find(
        (HDWalletAddress) =>
          sameQuaiAddress(HDWalletAddress.address, address as string)
      )
    )
  }

  public async deriveAddress(
    xPub: string,
    zone: Zone
  ): Promise<AddressWithQiHDWallet> {
    const qiHDWallet = await this.getByXPub(xPub)
    if (!qiHDWallet) {
      throw new Error("QiHDWallet not found.")
    }

    const { address } = await qiHDWallet.getNextAddress(
      this.qiHDWalletAccountIndex,
      zone
    )

    return { address, qiHDWallet }
  }

  // -------------------------- private methods --------------------------
  private async getByXPub(xPub: string): Promise<QiHDWallet | undefined> {
    const { qiHDWallets } = await this.vaultManager.get()
    const deserializedHDWallets: QiHDWallet[] = await Promise.all(
      qiHDWallets.map((HDWallet) => QiHDWallet.deserialize(HDWallet))
    )

    return deserializedHDWallets.find(
      (HDWallet: QiHDWallet) => HDWallet.xPub === xPub
    )
  }
}
