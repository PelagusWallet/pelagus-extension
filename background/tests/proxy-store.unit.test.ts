import { BACKGROUND_DISCONNECTED_ERROR, newProxyStore } from "../index"

const mockDisconnectListeners: (() => void)[] = []
let mockDispatch: jest.Mock

// index.ts pulls Main in for startMain; the proxy store does not need it.
jest.mock("../main", () => ({ __esModule: true, default: {} }))

jest.mock("webext-redux", () => ({
  Store: class {
    port = {
      onDisconnect: {
        addListener: (callback: () => void) => {
          mockDisconnectListeners.push(callback)
        },
      },
    }

    // eslint-disable-next-line class-methods-use-this
    dispatch(action: unknown) {
      return mockDispatch(action)
    }

    // eslint-disable-next-line class-methods-use-this
    ready() {
      return Promise.resolve()
    }
  },
}))

const disconnect = () =>
  mockDisconnectListeners.forEach((listener) => listener())

describe("proxy store background disconnect handling", () => {
  beforeEach(() => {
    mockDisconnectListeners.length = 0
    // webext-redux leaves this pending forever when the worker is gone.
    mockDispatch = jest.fn(() => new Promise(() => {}))
  })

  it("rejects an in-flight dispatch when the background disconnects", async () => {
    const store = await newProxyStore()
    const pending = store.dispatch({ type: "test" })

    disconnect()

    await expect(pending).rejects.toThrow(BACKGROUND_DISCONNECTED_ERROR)
  })

  it("still attempts dispatches after a disconnect, so a restarted worker can serve them", async () => {
    const store = await newProxyStore()
    disconnect()
    // A dispatch wakes a terminated worker; once it is up, it replies.
    mockDispatch = jest.fn(async () => "result")

    await expect(store.dispatch({ type: "test" })).resolves.toBe("result")
  })

  it("bounds a dispatch sent while the worker is restarting", async () => {
    jest.useFakeTimers()

    try {
      const store = await newProxyStore()
      disconnect()

      const pending = store.dispatch({ type: "test" })
      const assertion = expect(pending).rejects.toThrow(
        BACKGROUND_DISCONNECTED_ERROR
      )

      jest.advanceTimersByTime(15 * 1000)

      await assertion
    } finally {
      jest.useRealTimers()
    }
  })

  it("passes results through and leaves settled dispatches alone", async () => {
    mockDispatch = jest.fn(async () => "result")
    const store = await newProxyStore()

    await expect(store.dispatch({ type: "test" })).resolves.toBe("result")

    // A dispatch that already settled must not be disturbed by a later
    // disconnect — it is dropped from the pending set as it settles, which is
    // also what stops those entries accumulating for the life of the page.
    const settled = await store.dispatch({ type: "test" })
    disconnect()
    expect(settled).toBe("result")
  })
})
