import { TemplateType } from "./types"

export default class NotificationsManager {
  public createSuccessTxNotification(nonce: number | null | undefined): void {
    const options = {
      type: TemplateType.basic,
      iconUrl: "../../icon-128.png",
      title: "Confirmed transaction",
      message: `Transaction ${nonce} confirmed! View on QuaiScan`,
    }

    chrome.notifications.create(options)
  }

  public createFailedTxNotification(nonce: number | null | undefined): void {
    const options = {
      type: TemplateType.basic,
      iconUrl: "../../icon-128.png",
      title: "Failed transaction",
      message: `Transaction ${nonce} failed! View on QuaiScan`,
    }

    chrome.notifications.create(options)
  }
}
