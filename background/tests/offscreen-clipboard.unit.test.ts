import browser from "webextension-polyfill"
import {
  connectOffscreenClipboard,
  OffscreenClipboardCoordinator,
  OffscreenClipboardDependencies,
} from "../offscreen-clipboard"
import {
  sensitiveClipboardBackgroundTarget,
  sensitiveClipboardCopyMessageType,
} from "../../src/offscreen-clipboard-messages"
import logger from "../lib/logger"

function createDependencies(
  overrides: Partial<OffscreenClipboardDependencies> = {}
): OffscreenClipboardDependencies {
  return {
    getContexts: jest.fn().mockResolvedValue([]),
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    createDocument: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue({ success: true }),
    ...overrides,
  }
}

describe("OffscreenClipboardCoordinator", () => {
  beforeAll(() => {
    jest.spyOn(logger, "error").mockImplementation(() => {})
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  it("handles unavailable offscreen APIs without breaking startup", async () => {
    const originalOffscreen = chrome.offscreen
    const originalGetContexts = chrome.runtime.getContexts
    Object.assign(chrome, { offscreen: undefined })
    Object.assign(chrome.runtime, { getContexts: undefined })
    const addListener = jest.mocked(browser.runtime.onMessage.addListener)
    addListener.mockClear()

    try {
      expect(() => connectOffscreenClipboard()).not.toThrow()
      const listener = addListener.mock.calls[0][0]
      await expect(
        listener(
          {
            type: sensitiveClipboardCopyMessageType,
            target: sensitiveClipboardBackgroundTarget,
            data: "secret",
          },
          { id: browser.runtime.id, url: browser.runtime.getURL("popup.html") }
        )
      ).resolves.toMatchObject({ success: false })
    } finally {
      Object.assign(chrome, { offscreen: originalOffscreen })
      Object.assign(chrome.runtime, { getContexts: originalGetContexts })
    }
  })

  it("prefers hasDocument when the API is available", async () => {
    const dependencies = createDependencies({
      hasDocument: jest.fn().mockResolvedValue(true),
    })
    const coordinator = new OffscreenClipboardCoordinator(dependencies)

    await expect(coordinator.copy("secret")).resolves.toEqual({
      success: true,
    })

    expect(dependencies.hasDocument).toHaveBeenCalledTimes(1)
    expect(dependencies.getContexts).not.toHaveBeenCalled()
    expect(dependencies.createDocument).not.toHaveBeenCalled()
  })

  it("uses getContexts when hasDocument is unavailable", async () => {
    const dependencies = createDependencies({
      getContexts: jest.fn().mockResolvedValue([{}]),
    })
    const coordinator = new OffscreenClipboardCoordinator(dependencies)

    await expect(coordinator.copy("secret")).resolves.toEqual({
      success: true,
    })

    expect(dependencies.getContexts).toHaveBeenCalledWith({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: ["chrome-extension://test/offscreen.html"],
    })
    expect(dependencies.createDocument).not.toHaveBeenCalled()
  })

  it("shares one document-creation promise across concurrent copies", async () => {
    let finishCreatingDocument: (() => void) | undefined
    const documentCreation = new Promise<void>((resolve) => {
      finishCreatingDocument = resolve
    })
    const dependencies = createDependencies({
      createDocument: jest.fn(() => documentCreation),
    })
    const coordinator = new OffscreenClipboardCoordinator(dependencies)

    const firstCopy = coordinator.copy("first secret")
    const secondCopy = coordinator.copy("second secret")
    await Promise.resolve()
    await Promise.resolve()

    expect(dependencies.createDocument).toHaveBeenCalledTimes(1)
    finishCreatingDocument?.()

    await expect(Promise.all([firstCopy, secondCopy])).resolves.toEqual([
      { success: true },
      { success: true },
    ])
    expect(dependencies.sendMessage).toHaveBeenCalledTimes(2)
  })

  it("does not report success when the offscreen document rejects the copy", async () => {
    const dependencies = createDependencies({
      hasDocument: jest.fn().mockResolvedValue(true),
      sendMessage: jest
        .fn()
        .mockResolvedValue({ success: false, error: "copy failed" }),
    })
    const coordinator = new OffscreenClipboardCoordinator(dependencies)

    await expect(coordinator.copy("secret")).resolves.toEqual({
      success: false,
      error: "copy failed",
    })
  })
})
