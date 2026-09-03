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
