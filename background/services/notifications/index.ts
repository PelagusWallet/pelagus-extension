import { TemplateType } from "./types"
import { QUAI_SCAN_URL } from "../../constants"

export default abstract class NotificationsManager {
  public static createSuccessTxNotification(
    nonce: number | null | undefined,
    txHash: string | undefined
  ): void {
    const options = {
      type: TemplateType.basic,
      iconUrl: "../../icon-128.png",
      title: "Confirmed transaction",
      message: `Transaction ${nonce ?? 0} confirmed! View on QuaiScan`,
    }

    chrome.notifications.create(options, (notificationId) => {
      chrome.notifications.onClicked.addListener((listenerId) => {
        if (listenerId !== notificationId) return

        chrome.tabs.create({
          url: txHash ? `${QUAI_SCAN_URL}/tx/${txHash}` : QUAI_SCAN_URL,
        })
      })
    })
  }

  public static createFailedTxNotification(
    nonce: number | null | undefined,
    txHash: string | undefined
  ): void {
    const options = {
      type: TemplateType.basic,
      iconUrl: "../../icon-128.png",
      title: "Failed transaction",
      message: `Transaction ${nonce ?? 0} failed! View on QuaiScan`,
    }

    chrome.notifications.create(options, (notificationId) => {
      chrome.notifications.onClicked.addListener((listenerId) => {
        if (listenerId !== notificationId) return

        chrome.tabs.create({
          url: txHash ? `${QUAI_SCAN_URL}/tx/${txHash}` : QUAI_SCAN_URL,
        })
      })
    })
  }
}
