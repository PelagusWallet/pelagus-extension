import { AddressLike, Mnemonic, QuaiHDWallet, Zone } from "quais"
import { IVaultManager } from "../vault-manager"
import { sameQuaiAddress } from "../../../lib/utils"
import { AddressWithQuaiHDWallet } from "../types"
import { applicationError } from "../../../constants/errorsCause"

export interface IQuaiHDWalletManager {
  add(mnemonic: string): Promise<AddressWithQuaiHDWallet>
  getByXPub(xPub: string): Promise<QuaiHDWallet | undefined>
  getByAddress(address: AddressLike): Promise<QuaiHDWallet | undefined>
  deriveAddress(xPub: string, zone: Zone): Promise<AddressWithQuaiHDWallet>
}

export default class QuaiHDWalletManager implements IQuaiHDWalletManager {
  public readonly quaiHDWalletAccountIndex: number = 0

  constructor(private vaultManager: IVaultManager) {}

  // -------------------------- public methods --------------------------
  public async add(mnemonic: string): Promise<AddressWithQuaiHDWallet> {
    const mnemonicFromPhrase = Mnemonic.fromPhrase(mnemonic)
    const quaiHDWallet = QuaiHDWallet.fromMnemonic(mnemonicFromPhrase)

    const existingQuaiHDWallet = await this.getByXPub(quaiHDWallet.xPub)
    if (existingQuaiHDWallet) {
      throw new Error("Quai HD Wallet already in use", {
        cause: applicationError,
      })
    }

    const { address } = await quaiHDWallet.getNextAddress(
      this.quaiHDWalletAccountIndex,
      Zone.Cyprus1
    )

    return { address, quaiHDWallet }
  }

  public async getByXPub(xPub: string): Promise<QuaiHDWallet | undefined> {
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

  public async deriveAddress(
    xPub: string,
    zone: Zone
  ): Promise<AddressWithQuaiHDWallet> {
    const quaiHDWallet = await this.getByXPub(xPub)
    if (!quaiHDWallet) {
      throw new Error("QuaiHDWallet not found.")
    }

    const { address } = await quaiHDWallet.getNextAddress(
      this.quaiHDWalletAccountIndex,
      zone
    )

    return { address, quaiHDWallet }
  }
}
