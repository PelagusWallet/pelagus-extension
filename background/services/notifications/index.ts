import { TemplateType } from "./types"
import { QUAI_SCAN_URL } from "../../constants"
import { truncateAddress } from "../../lib/utils"
import {
  setShowingActivityDetail,
  setSnackbarConfig,
} from "../../redux-slices/ui"
import { walletOpen } from "../../main"
import { SnackBarType } from "../../redux-slices/utils"

export default abstract class NotificationsManager {
  private static async isNotificationsEnabled(): Promise<boolean> {
    const isEnabled =
      await globalThis.main.preferenceService.getShowPelagusNotificationsValue()
    return isEnabled
  }

  public static async createSuccessTxNotification(
    nonce: number | null | undefined,
    txHash: string | undefined
  ): Promise<void> {
    const isEnabled = await this.isNotificationsEnabled()
    if (!isEnabled) return

    const options = {
      type: TemplateType.basic,
      iconUrl: "../../icon-128.png",
      title: "Confirmed transaction",
      message: `Transaction ${nonce ?? 0} confirmed! View on QuaiScan`,
    }

    if (!walletOpen) {
      chrome.notifications.create(options, (notificationId) => {
        chrome.notifications.onClicked.addListener((listenerId) => {
          if (listenerId !== notificationId) return

          chrome.tabs.create({
            url: txHash ? `${QUAI_SCAN_URL}/tx/${txHash}` : QUAI_SCAN_URL,
          })
        })
      })
      return
    }

    globalThis.main.store.dispatch(
      setSnackbarConfig({
        message: `Transaction ${nonce ?? 0} confirmed! Click to view details`,
        withSound: true,
        type: SnackBarType.transactionSettled,
      })
    )
    globalThis.main.store.dispatch(setShowingActivityDetail(txHash ?? ""))
  }

  public static async createIncomingAssetsNotification(
    amount: string,
    symbol: string,
    address: string
  ): Promise<void> {
    const isEnabled = await this.isNotificationsEnabled()
    if (!isEnabled) return

    const message = `You have received ${amount} ${symbol} in your wallet address ${truncateAddress(
      address
    )}`
    const options = {
      type: TemplateType.basic,
      iconUrl: "../../icon-128.png",
      title: "Funds Received",
      message,
    }

    if (!walletOpen) {
      chrome.notifications.create(options)
      return
    }

    globalThis.main.store.dispatch(
      setSnackbarConfig({ message, withSound: true })
    )
  }
}
