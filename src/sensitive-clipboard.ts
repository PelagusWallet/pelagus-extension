import browser from "webextension-polyfill"
import {
  SensitiveClipboardResponse,
  sensitiveClipboardBackgroundTarget,
  sensitiveClipboardCopyMessageType,
} from "./offscreen-clipboard-messages"

export default async function addToOffscreenClipboardSensitiveData(
  value: string
): Promise<void> {
  const response = (await browser.runtime.sendMessage({
    type: sensitiveClipboardCopyMessageType,
    target: sensitiveClipboardBackgroundTarget,
    data: value,
  })) as SensitiveClipboardResponse | undefined

  if (response?.success !== true) {
    throw new Error(response?.error || "Unable to copy sensitive data")
  }
}
