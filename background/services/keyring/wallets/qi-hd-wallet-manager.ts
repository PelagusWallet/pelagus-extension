import { Contract, Mnemonic, QiHDWallet, Zone } from "quais"
import { IVaultManager } from "../vault-manager"
import { AddressWithQiHDWallet } from "../types"
import {
  MAILBOX_EVENTS,
  MAILBOX_INTERFACE,
} from "../../../contracts/payment-channel-mailbox"
import { MAILBOX_CONTRACT_ADDRESS } from "../../../constants"
import logger from "../../../lib/logger"

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
    const thisQiWalletPaymentCode = qiWallet.getPaymentCode()

    const mailboxContract = new Contract(
      MAILBOX_CONTRACT_ADDRESS || "",
      MAILBOX_INTERFACE,
      jsonRpcProvider
    )

    let notifications: string[] = []
    try {
      notifications = await mailboxContract.getNotifications(
        thisQiWalletPaymentCode
      )
    } catch (error) {
      console.error(
        "Error getting notifications. Make sure mailbox contract is deployed on the same network as the wallet."
      )
    }

    qiWallet.connect(jsonRpcProvider)
    notifications.forEach((paymentCode) => {
      qiWallet.openChannel(paymentCode)
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
    globalThis.main.chainService.subscribeToQiAddresses()
  }

  private async subscribeToContractEvents(): Promise<void> {
    const { qiHDWallet } = await this.vaultManager.get()
    if (!qiHDWallet) return

    const { webSocketProvider, jsonRpcProvider } = globalThis.main.chainService
    let deserializedQiHDWallet: QiHDWallet
    try {
      deserializedQiHDWallet = await QiHDWallet.deserialize(qiHDWallet)
    } catch (error) {
      const errorRegex = /Address (0x[a-fA-F0-9]{40}) not found in wallet/
      const match = (error as Error).message.match(errorRegex)
      if (match) {
        logger.info("Error locating address for outpoint. Rescanning...")
        const removedOutpointsSerialized = {
          ...qiHDWallet,
          outpoints: [],
          pendingOutpoints: [],
        }
        deserializedQiHDWallet = await QiHDWallet.deserialize(
          removedOutpointsSerialized
        )
        deserializedQiHDWallet.connect(jsonRpcProvider)
        await deserializedQiHDWallet.scan(Zone.Cyprus1, 0)
        logger.info("Rescan successful. Adding to vault...")
        await this.vaultManager.add(
          {
            qiHDWallet: deserializedQiHDWallet.serialize(),
          },
          {}
        )
      }
      throw error
    }

    deserializedQiHDWallet.connect(webSocketProvider)

    const thisQiWalletPaymentCode = deserializedQiHDWallet.getPaymentCode(
      this.qiHDWalletAccountIndex
    )
    const mailboxContract = new Contract(
      MAILBOX_CONTRACT_ADDRESS || "",
      MAILBOX_INTERFACE,
      webSocketProvider
    )
    mailboxContract.on(
      MAILBOX_EVENTS.NotificationSent.name,
      async (senderPaymentCode: string, receiverPaymentCode: string) => {
        if (thisQiWalletPaymentCode === receiverPaymentCode) {
          deserializedQiHDWallet.openChannel(senderPaymentCode)
          await deserializedQiHDWallet.sync(Zone.Cyprus1, 0)
          await this.vaultManager.add(
            {
              qiHDWallet: deserializedQiHDWallet.serialize(),
            },
            {}
          )
          await globalThis.main.chainService.subscribeToQiAddresses()
        }
      }
    )
  }
}
