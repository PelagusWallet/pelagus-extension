export const sensitiveClipboardCopyMessageType =
  "copy-sensitive-data-to-clipboard"

export const sensitiveClipboardBackgroundTarget =
  "sensitive-clipboard-background"

export const sensitiveClipboardDocumentTarget = "sensitive-clipboard-document"

export type SensitiveClipboardCopyMessage = {
  type: typeof sensitiveClipboardCopyMessageType
  target:
    | typeof sensitiveClipboardBackgroundTarget
    | typeof sensitiveClipboardDocumentTarget
  data: string
}

export type SensitiveClipboardResponse = {
  success: boolean
  error?: string
}

type ClipboardMessageSender = Pick<chrome.runtime.MessageSender, "id" | "url">

export function isTrustedExtensionPageSender(
  sender: ClipboardMessageSender,
  extensionID: string,
  extensionRootURL: string
): boolean {
  return (
    sender.id === extensionID &&
    typeof sender.url === "string" &&
    sender.url.startsWith(extensionRootURL)
  )
}

export function isTrustedBackgroundSender(
  sender: ClipboardMessageSender,
  extensionID: string,
  backgroundURL: string
): boolean {
  return sender.id === extensionID && sender.url === backgroundURL
}

export function isSensitiveClipboardCopyMessage(
  message: unknown,
  target: SensitiveClipboardCopyMessage["target"]
): message is SensitiveClipboardCopyMessage {
  if (typeof message !== "object" || message === null) return false

  const candidate = message as Partial<SensitiveClipboardCopyMessage>
  return (
    candidate.type === sensitiveClipboardCopyMessageType &&
    candidate.target === target &&
    typeof candidate.data === "string"
  )
}
