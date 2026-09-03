import browser from "webextension-polyfill"
import {
  EIP1193_ERROR_CODES,
  PELAGUS_GET_CONFIG_METHOD,
  PELAGUS_HEALTH_CHECK_METHOD,
  PORT_HEALTH_CHECK_INTERVAL_IN_MILLISECONDS,
  PORT_RECONNECT_TIMEOUT_IN_MILLISECONDS,
  PROVIDER_BRIDGE_TARGET,
} from "@pelagus-provider/provider-bridge-shared"
import { initializePelagusProviderBridge } from ".."

function createPort(failingMethod?: string) {
  return {
    postMessage: jest.fn((message) => {
      if (message.request.method === failingMethod) {
        throw new Error("Port is disconnected")
      }
    }),
    onMessage: { addListener: jest.fn() },
    onDisconnect: { addListener: jest.fn() },
  }
}

describe("provider bridge connection recovery", () => {
  let pageListener: ((event: MessageEvent) => void) | undefined

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    pageListener = undefined
    jest
      .spyOn(window, "addEventListener")
      .mockImplementation((type, listener) => {
        if (type === "message") {
          pageListener = listener as (event: MessageEvent) => void
        }
      })
    jest.spyOn(window, "postMessage").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  function sendRequest(id: string) {
    const data = {
      id,
      target: PROVIDER_BRIDGE_TARGET,
      request: { method: "quai_chainId", params: [] },
    }
    pageListener?.(
      new MessageEvent("message", {
        data,
        source: window,
        origin: window.location.origin,
      })
    )
    return data
  }

  it.each([
    ["startup", PELAGUS_GET_CONFIG_METHOD],
    ["startup", PELAGUS_HEALTH_CHECK_METHOD],
    ["reconnect", PELAGUS_GET_CONFIG_METHOD],
    ["reconnect", PELAGUS_HEALTH_CHECK_METHOD],
  ])("recovers when %s fails sending %s", (stage, failingMethod) => {
    const original = createPort()
    const failed = createPort(failingMethod)
    const recovered = createPort()
    const ports =
      stage === "startup" ? [failed, recovered] : [original, failed, recovered]
    const expectedConnections = ports.length
    const connect = jest
      .spyOn(browser.runtime, "connect")
      .mockImplementation(
        () => ports.shift() as unknown as browser.Runtime.Port
      )

    expect(() => initializePelagusProviderBridge()).not.toThrow()
    expect(pageListener).toBeDefined()

    if (stage === "reconnect") {
      sendRequest("pending-before-disconnect")
      original.onDisconnect.addListener.mock.calls[0][0]()
      expect(window.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "pending-before-disconnect",
          result: EIP1193_ERROR_CODES.disconnected,
        }),
        window.location.origin
      )
      expect(() =>
        jest.advanceTimersByTime(PORT_RECONNECT_TIMEOUT_IN_MILLISECONDS)
      ).not.toThrow()
    }

    // A failed handshake schedules one retry without starting health checks.
    expect(jest.getTimerCount()).toBe(1)
    jest.advanceTimersByTime(PORT_RECONNECT_TIMEOUT_IN_MILLISECONDS)
    expect(connect).toHaveBeenCalledTimes(expectedConnections)
    expect(recovered.postMessage).toHaveBeenCalledTimes(2)
    expect(recovered.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          method: PELAGUS_HEALTH_CHECK_METHOD,
        }),
      })
    )

    const request = sendRequest("pending-after-reconnect")
    expect(recovered.postMessage).toHaveBeenLastCalledWith(request)
    jest.mocked(window.postMessage).mockClear()

    // A late disconnect from the failed port must not disrupt its replacement.
    failed.onDisconnect.addListener.mock.calls[0][0]()
    expect(window.postMessage).not.toHaveBeenCalled()
    jest.advanceTimersByTime(PORT_HEALTH_CHECK_INTERVAL_IN_MILLISECONDS)
    expect(connect).toHaveBeenCalledTimes(expectedConnections)
    expect(recovered.postMessage).toHaveBeenCalledTimes(4)
    expect(jest.getTimerCount()).toBe(1)
  })
})
