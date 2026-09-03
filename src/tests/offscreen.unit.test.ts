import {
  sensitiveClipboardCopyMessageType,
  sensitiveClipboardDocumentTarget,
} from "../offscreen-clipboard-messages"

type OffscreenMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
) => false

function loadOffscreenListener(): {
  listener: OffscreenMessageListener
  textArea: HTMLTextAreaElement
} {
  jest.resetModules()
  document.body.innerHTML = '<textarea id="text"></textarea>'
  jest.mocked(chrome.runtime.onMessage.addListener).mockClear()

  // eslint-disable-next-line global-require
  require("../offscreen")

  const listener = jest.mocked(chrome.runtime.onMessage.addListener).mock
    .calls[0][0] as OffscreenMessageListener
  const textArea = document.querySelector<HTMLTextAreaElement>("#text")
  if (!textArea) throw new Error("Test clipboard textarea was not created")

  return { listener, textArea }
}

function copyMessage(data: string) {
  return {
    type: sensitiveClipboardCopyMessageType,
    target: sensitiveClipboardDocumentTarget,
    data,
  }
}

function trustedBackgroundSender(): chrome.runtime.MessageSender {
  return {
    id: chrome.runtime.id,
    url: chrome.runtime.getURL("background.js"),
  }
}

describe("offscreen sensitive clipboard failures", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("removes the secret when the browser rejects the copy command", () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: jest.fn().mockReturnValue(false),
    })
    const { listener, textArea } = loadOffscreenListener()
    const sendResponse = jest.fn()

    listener(
      copyMessage("seed phrase"),
      trustedBackgroundSender(),
      sendResponse
    )

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: "The browser rejected the copy command",
    })
    expect(textArea.value).toBe("")
  })

  it("removes the secret when the copy command throws", () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: jest.fn(() => {
        throw new Error("copy unavailable")
      }),
    })
    const { listener, textArea } = loadOffscreenListener()
    const sendResponse = jest.fn()

    listener(
      copyMessage("private key"),
      trustedBackgroundSender(),
      sendResponse
    )

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: "copy unavailable",
    })
    expect(textArea.value).toBe("")
  })

  it("ignores clipboard writes from a content script", () => {
    const execCommand = jest.fn().mockReturnValue(true)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    })
    const { listener, textArea } = loadOffscreenListener()
    const sendResponse = jest.fn()

    listener(
      copyMessage("attacker address"),
      {
        id: chrome.runtime.id,
        tab: {} as chrome.tabs.Tab,
        url: "https://compromised-dapp.example",
      },
      sendResponse
    )

    expect(execCommand).not.toHaveBeenCalled()
    expect(sendResponse).not.toHaveBeenCalled()
    expect(textArea.value).toBe("")
  })
})
