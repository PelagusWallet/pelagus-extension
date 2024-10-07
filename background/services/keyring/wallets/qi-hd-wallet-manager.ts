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
  syncQiWalletPaymentCodes(qiWallet: QiHDWallet): Promise<void>
}

export default class QiHDWalletManager implements IQiHDWalletManager {
  public readonly qiHDWalletAccountIndex: number = 0

  constructor(private vaultManager: IVaultManager) {}

  public async create(phrase: string): Promise<AddressWithQiHDWallet> {
    const mnemonic = Mnemonic.fromPhrase(phrase)
    const qiHDWallet = QiHDWallet.fromMnemonic(mnemonic)
    const { address } = await qiHDWallet.getNextAddress(
      this.qiHDWalletAccountIndex,
      Zone.Cyprus1
    )

    return { address, qiHDWallet }
  }

  public async get(): Promise<QiHDWallet | null> {
    const { qiHDWallet } = await this.vaultManager.get()
    if (!qiHDWallet) return null

    return QiHDWallet.deserialize(qiHDWallet)
  }

  public async syncQiWalletPaymentCodes(
    qiWallet: QiHDWallet,
    isRestored = false
  ): Promise<void> {
    const { jsonRpcProvider } = globalThis.main.chainService
    const thisQiWalletPaymentCode = await qiWallet.getPaymentCode()

    const mailboxContract = new Contract(
      process.env.MAILBOX_CONTRACT_ADDRESS || "",
      MAILBOX_INTERFACE,
      jsonRpcProvider
    )
    const notifications: string[] = await mailboxContract.getNotifications(
      thisQiWalletPaymentCode
    )

    qiWallet.connect(jsonRpcProvider)
    notifications.forEach((paymentCode) => {
      qiWallet.openChannel(paymentCode, "sender")
    })

    if (isRestored) {
      await qiWallet.scan(Zone.Cyprus1, 0)
    } else {
      await qiWallet.sync(Zone.Cyprus1, 0)
    }

    await this.vaultManager.add(
      {
        qiHDWallet: qiWallet.serialize(),
      },
      {}
    )
    this.subscribeToContractEvents()
  }

  private async subscribeToContractEvents(): Promise<void> {
    const { qiHDWallet } = await this.vaultManager.get()
    if (!qiHDWallet) return

    const deserializedQiHDWallet = await QiHDWallet.deserialize(qiHDWallet)
    const thisQiWalletPaymentCode = await deserializedQiHDWallet.getPaymentCode(
      this.qiHDWalletAccountIndex
    )

    const { webSocketProvider } = globalThis.main.chainService
    deserializedQiHDWallet.connect(webSocketProvider)

    const mailboxContract = new Contract(
      process.env.MAILBOX_CONTRACT_ADDRESS || "",
      MAILBOX_INTERFACE,
      webSocketProvider
    )
    mailboxContract.on(
      MAILBOX_EVENTS.NotificationSent.name,
      async (senderPaymentCode: string, receiverPaymentCode: string) => {
        if (thisQiWalletPaymentCode === receiverPaymentCode) {
          deserializedQiHDWallet.openChannel(senderPaymentCode, "sender")
          await deserializedQiHDWallet.sync(Zone.Cyprus1, 0)
          await this.vaultManager.add(
            {
              qiHDWallet: deserializedQiHDWallet.serialize(),
            },
            {}
          )
        }
      }
    )
  }
}
