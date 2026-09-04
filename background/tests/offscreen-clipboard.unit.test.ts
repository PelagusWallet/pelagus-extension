import {
  OffscreenClipboardCoordinator,
  OffscreenClipboardDependencies,
} from "../offscreen-clipboard"
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
