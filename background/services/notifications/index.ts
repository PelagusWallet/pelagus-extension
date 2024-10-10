import {
  setShowingActivityDetail,
  setSnackbarConfig,
} from "../../redux-slices/ui"
import { TemplateType } from "./types"
import { walletOpen } from "../../main"
import { QUAI_SCAN_URL } from "../../constants"
import { truncateAddress } from "../../lib/utils"
import { SnackBarType } from "../../redux-slices/utils"

const DEFAULT_NOTIFICATION_OPTIONS = {
  type: TemplateType.basic,
  iconUrl: "../../icon-128.png",
}

const DURATION_MS = 5000

export default abstract class NotificationsManager {
  private static isNotificationsEnabled(): boolean {
    return globalThis.main.store.getState().ui.settings.showPelagusNotifications
  }

  private static createChromeNotification(
    options: chrome.notifications.NotificationOptions<true>,
    onClickUrl?: string
  ): void {
    chrome.notifications.create(options, (notificationId) => {
      if (!onClickUrl) return

      chrome.notifications.onClicked.addListener((listenerId) => {
        if (listenerId === notificationId) {
          chrome.tabs.create({ url: onClickUrl })
        }
      })
    })
  }

  public static createSuccessTxNotification(
    nonce: number | null | undefined,
    txHash: string
  ): void {
    if (!this.isNotificationsEnabled()) return

    const options = {
      ...DEFAULT_NOTIFICATION_OPTIONS,
      title: "Confirmed transaction",
      message: `Transaction ${nonce ?? 0} confirmed! View on QuaiScan`,
    }

    if (!walletOpen) {
      this.createChromeNotification(options, `${QUAI_SCAN_URL}/tx/${txHash}`)
    } else {
      const { store } = globalThis.main
      store.dispatch(
        setSnackbarConfig({
          message: `Transaction ${nonce ?? 0} confirmed! Click to view details`,
          withSound: true,
          type: SnackBarType.transactionSettled,
          duration: DURATION_MS,
        })
      )
      store.dispatch(setShowingActivityDetail(txHash))
    }
  }

  public static createIncomingAssetsNotification(
    amount: string,
    symbol: string,
    address: string
  ): void {
    if (!this.isNotificationsEnabled()) return

    const options = {
      ...DEFAULT_NOTIFICATION_OPTIONS,
      title: "Funds Received",
      message: `You have received ${amount} ${symbol} in your wallet address ${truncateAddress(
        address
      )}`,
    }

    if (!walletOpen) {
      this.createChromeNotification(options)
    } else {
      const { store } = globalThis.main
      store.dispatch(
        setSnackbarConfig({
          message: `You have received ${amount} ${symbol}`,
          withSound: true,
          duration: DURATION_MS,
        })
      )
    }
  }

  public static createSendQiTxNotification(): void {
    if (!this.isNotificationsEnabled()) return

    const options = {
      ...DEFAULT_NOTIFICATION_OPTIONS,
      title: "Qi transaction",
      message: `Qi transaction is sent. Monitor your balance!`,
    }

    if (!walletOpen) {
      this.createChromeNotification(options)
    } else {
      const { store } = globalThis.main
      store.dispatch(
        setSnackbarConfig({
          message: `Qi transaction is sent`,
          withSound: true,
          type: SnackBarType.transactionSettled,
          duration: DURATION_MS,
        })
      )
    }
  }

  public static createFailedQiTxNotification(): void {
    if (!this.isNotificationsEnabled()) return

    const options = {
      ...DEFAULT_NOTIFICATION_OPTIONS,
      title: "Qi transaction",
      message: `Failed to sent qi transaction!`,
    }

    if (!walletOpen) {
      this.createChromeNotification(options)
    } else {
      const { store } = globalThis.main
      store.dispatch(
        setSnackbarConfig({
          message: `Qi transaction failed to send`,
          withSound: true,
          type: SnackBarType.transactionSettled,
          duration: DURATION_MS,
        })
      )
    }
  }
}
