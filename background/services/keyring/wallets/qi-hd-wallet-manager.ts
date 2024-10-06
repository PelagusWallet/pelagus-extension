import { Contract, Mnemonic, QiHDWallet, Zone } from "quais"
import { IVaultManager } from "../vault-manager"
import { AddressWithQiHDWallet } from "../types"
import {
  MAILBOX_EVENTS,
  MAILBOX_INTERFACE,
} from "../../../contracts/payment-channel-mailbox"

export interface IQiHDWalletManager {
  get(): Promise<QiHDWallet | null>
  create(mnemonic: string): Promise<AddressWithQiHDWallet>
  deriveAddress(zone: Zone): Promise<AddressWithQiHDWallet>
  syncQiWalletPaymentCodes(qiWallet: QiHDWallet): Promise<void>
}

export default class QiHDWalletManager implements IQiHDWalletManager {
  public readonly qiHDWalletAccountIndex: number = 0

  constructor(private vaultManager: IVaultManager) {}

  // -------------------------- public methods --------------------------
  public async create(mnemonic: string): Promise<AddressWithQiHDWallet> {
    const { jsonRpcProvider } = globalThis.main.chainService

    const existingQiHDWallet = await this.get()
    if (existingQiHDWallet) {
      throw new Error("Qi HD Wallet already in use")
    }

    const mnemonicFromPhrase = Mnemonic.fromPhrase(mnemonic)
    const qiHDWallet = QiHDWallet.fromMnemonic(mnemonicFromPhrase)
    const { address } = await qiHDWallet.getNextAddress(
      this.qiHDWalletAccountIndex,
      Zone.Cyprus1
    )

    qiHDWallet.connect(jsonRpcProvider)
    await qiHDWallet.scan(Zone.Cyprus1, 0)

    this.syncQiWalletPaymentCodes(qiHDWallet)

    return { address, qiHDWallet }
  }

  public async get(): Promise<QiHDWallet | null> {
    const { qiHDWallet } = await this.vaultManager.get()
    if (!qiHDWallet) return null

    return QiHDWallet.deserialize(qiHDWallet)
  }

  public async deriveAddress(zone: Zone): Promise<AddressWithQiHDWallet> {
    const qiHDWallet = await this.get()
    if (!qiHDWallet) {
      throw new Error("QiHDWallet was not found.")
    }

    const { address } = await qiHDWallet.getNextAddress(
      this.qiHDWalletAccountIndex,
      zone
    )

    return { address, qiHDWallet }
  }

  public async syncQiWalletPaymentCodes(qiWallet: QiHDWallet): Promise<void> {
    const { webSocketProvider } = globalThis.main.chainService
    const thisQiWalletPaymentCode = await qiWallet.getPaymentCode()

    const mailboxContract = new Contract(
      process.env.MAILBOX_CONTRACT_ADDRESS || "",
      MAILBOX_INTERFACE,
      webSocketProvider
    )
    const notifications: string[] = await mailboxContract.getNotifications(
      thisQiWalletPaymentCode
    )

    qiWallet.connect(webSocketProvider)
    notifications.forEach((paymentCode) => {
      qiWallet.openChannel(paymentCode, "sender")
    })
    await qiWallet.sync(Zone.Cyprus1, 0)

    mailboxContract.on(
      MAILBOX_EVENTS.NotificationSent.name,
      async (senderPaymentCode: string, receiverPaymentCode: string) => {
        if (thisQiWalletPaymentCode === receiverPaymentCode) {
          qiWallet.openChannel(senderPaymentCode, "sender")
          qiWallet.sync(Zone.Cyprus1, 0)
        }
      }
    )
  }
}
