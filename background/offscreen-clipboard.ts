import browser from "webextension-polyfill"
import {
  SensitiveClipboardCopyMessage,
  SensitiveClipboardResponse,
  isSensitiveClipboardCopyMessage,
  isTrustedExtensionPageSender,
  sensitiveClipboardBackgroundTarget,
  sensitiveClipboardCopyMessageType,
  sensitiveClipboardDocumentTarget,
} from "../src/offscreen-clipboard-messages"
import logger from "./lib/logger"

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html"

export type OffscreenClipboardDependencies = {
  hasDocument?: () => Promise<boolean>
  getContexts: (filter: chrome.runtime.ContextFilter) => Promise<unknown[]>
  getURL: (path: string) => string
  createDocument: (
    parameters: chrome.offscreen.CreateParameters
  ) => Promise<void>
  sendMessage: (message: SensitiveClipboardCopyMessage) => Promise<unknown>
}

export class OffscreenClipboardCoordinator {
  private creatingDocument: Promise<void> | null = null

  constructor(private readonly dependencies: OffscreenClipboardDependencies) {}

  private async documentExists(): Promise<boolean> {
    if (this.dependencies.hasDocument) {
      return this.dependencies.hasDocument()
    }

    const offscreenUrl = this.dependencies.getURL(OFFSCREEN_DOCUMENT_PATH)
    const contexts = await this.dependencies.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
      documentUrls: [offscreenUrl],
    })

    return contexts.length > 0
  }

  private async ensureDocument(): Promise<void> {
    if (this.creatingDocument) {
      await this.creatingDocument
      return
    }

    if (await this.documentExists()) return

    if (!this.creatingDocument) {
      this.creatingDocument = this.dependencies.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ["CLIPBOARD" as chrome.offscreen.Reason],
        justification: "Write sensitive text to the clipboard.",
      })
    }

    const { creatingDocument } = this
    if (!creatingDocument) {
      throw new Error("Offscreen document creation did not start")
    }
    try {
      await creatingDocument
    } finally {
      if (this.creatingDocument === creatingDocument) {
        this.creatingDocument = null
      }
    }
  }

  public async copy(value: string): Promise<SensitiveClipboardResponse> {
    try {
      await this.ensureDocument()

      const response = (await this.dependencies.sendMessage({
        type: sensitiveClipboardCopyMessageType,
        target: sensitiveClipboardDocumentTarget,
        data: value,
      })) as SensitiveClipboardResponse | undefined

      if (response?.success !== true) {
        throw new Error(response?.error || "Offscreen clipboard write failed")
      }

      return response
    } catch (error) {
      logger.error("Failed to copy sensitive data to the clipboard", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

function createDefaultCoordinator(): OffscreenClipboardCoordinator {
  return new OffscreenClipboardCoordinator({
    hasDocument:
      typeof chrome.offscreen.hasDocument === "function"
        ? () => chrome.offscreen.hasDocument()
        : undefined,
    getContexts: (filter) => chrome.runtime.getContexts(filter),
    getURL: (path) => chrome.runtime.getURL(path),
    createDocument: (parameters) => chrome.offscreen.createDocument(parameters),
    sendMessage: (message) => browser.runtime.sendMessage(message),
  })
}

export function connectOffscreenClipboard(): void {
  const coordinator = createDefaultCoordinator()

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (
      !isTrustedExtensionPageSender(
        sender,
        browser.runtime.id,
        browser.runtime.getURL("")
      ) ||
      !isSensitiveClipboardCopyMessage(
        message,
        sensitiveClipboardBackgroundTarget
      )
    ) {
      return undefined
    }

    return coordinator.copy(message.data)
  })
}
