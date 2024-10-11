import { AddressLike, Mnemonic, QiHDWallet, Zone } from "quais"

import { IVaultManager } from "./vault-manager"
import { sameQuaiAddress } from "../../lib/utils"
import { AddressWithQiHDWallet } from "./types"
import { applicationError } from "../../constants/errorsCause"

export interface IQiHDWalletManager {
  add(mnemonic: string): Promise<AddressWithQiHDWallet>
  getByXPub(xPub: string): Promise<QiHDWallet | undefined>
  getByAddress(address: AddressLike): Promise<QiHDWallet | undefined>
  deriveAddress(xPub: string, zone: Zone): Promise<AddressWithQiHDWallet>
}

export default class QiHDWalletManager implements IQiHDWalletManager {
  public readonly qiHDWalletAccountIndex: number = 0

  constructor(private vaultManager: IVaultManager) {}

  // -------------------------- public methods --------------------------
  public async add(mnemonic: string): Promise<AddressWithQiHDWallet> {
    const mnemonicFromPhrase = Mnemonic.fromPhrase(mnemonic)
    const qiHDWallet = QiHDWallet.fromMnemonic(mnemonicFromPhrase)

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

  public async getByXPub(xPub: string): Promise<QiHDWallet | undefined> {
    const { qiHDWallets } = await this.vaultManager.get()

    const deserializedQiHDWallets: QiHDWallet[] = await Promise.all(
      qiHDWallets.map((qiHDWallet) => QiHDWallet.deserialize(qiHDWallet))
    )

    return deserializedQiHDWallets.find(
      (qiHDWallet: QiHDWallet) => qiHDWallet.xPub === xPub
    )
  }

  public async getByAddress(
    address: AddressLike
  ): Promise<QiHDWallet | undefined> {
    const { qiHDWallets } = await this.vaultManager.get()

    const deserializedQiHDWallets: QiHDWallet[] = await Promise.all(
      qiHDWallets.map((qiHDWallet) => QiHDWallet.deserialize(qiHDWallet))
    )

    return deserializedQiHDWallets.find((qiHDWallet) =>
      qiHDWallet
        .getAddressesForAccount(this.qiHDWalletAccountIndex)
        .find((qiHDWalletAddress) =>
          sameQuaiAddress(qiHDWalletAddress.address, address as string)
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
}
