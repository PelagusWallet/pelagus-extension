/* eslint-disable @typescript-eslint/no-use-before-define */

import {
  isSensitiveClipboardCopyMessage,
  SensitiveClipboardResponse,
  sensitiveClipboardDocumentTarget,
} from "./offscreen-clipboard-messages"

// Registering this listener when the script is first executed ensures that the
// offscreen document can receive messages as soon as its creation resolves.
chrome.runtime.onMessage.addListener(handleMessages)

function handleMessages(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: SensitiveClipboardResponse) => void
): false {
  if (
    !isSensitiveClipboardCopyMessage(message, sensitiveClipboardDocumentTarget)
  ) {
    return false
  }

  sendResponse(handleClipboardWrite(message.data))
  return false
}

// We use a <textarea> to preserve multiline formatting and select its content.
const textEl = document.querySelector<HTMLTextAreaElement>("#text")
const SENSITIVE_CLIPBOARD_CLEAR_DELAY_MS = 15000
let clearClipboardTimer: ReturnType<typeof setTimeout> | undefined

// Offscreen documents cannot be focused, so navigator.clipboard is unavailable.
// document.execCommand("copy") writes the selected textarea content instead.
function handleClipboardWrite(data: string): SensitiveClipboardResponse {
  if (!textEl) {
    return { success: false, error: "Clipboard textarea was not found" }
  }

  try {
    textEl.value = data
    textEl.select()

    if (!document.execCommand("copy")) {
      return { success: false, error: "The browser rejected the copy command" }
    }

    if (clearClipboardTimer !== undefined) {
      clearTimeout(clearClipboardTimer)
    }

    clearClipboardTimer = setTimeout(() => {
      textEl.value = " "
      textEl.select()
      document.execCommand("copy")
      clearClipboardTimer = undefined
    }, SENSITIVE_CLIPBOARD_CLEAR_DELAY_MS)

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
