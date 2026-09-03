import {
  EIP1193_ERROR_CODES,
  PortResponseEvent,
  ProviderTransport,
  WindowRequestEvent,
} from "@pelagus-provider/provider-bridge-shared"
import PelagusWindowProvider from "../index"

function createTransport(): {
  listeners: Array<(event: unknown) => void>
  postMessage: jest.Mock<void, [WindowRequestEvent]>
  transport: ProviderTransport
} {
  const listeners: Array<(event: unknown) => void> = []
  const postMessage = jest.fn<void, [WindowRequestEvent]>()
  const transport = {
    origin: "https://dapp.example",
    postMessage,
    addEventListener: (listener: (event: unknown) => void) => {
      listeners.push(listener)
    },
    removeEventListener: () => undefined,
  } as ProviderTransport

  return { listeners, postMessage, transport }
}

describe("PelagusWindowProvider request lifecycle", () => {
  it("registers the resolver before sending the request", async () => {
    const { listeners, postMessage, transport } = createTransport()
    const provider = new PelagusWindowProvider(transport)

    postMessage.mockImplementation((request) => {
      expect(provider.requestResolvers.has(request.id)).toBe(true)

      const response: PortResponseEvent = {
        id: request.id,
        jsonrpc: "2.0",
        result: "0x1",
      }
      listeners.forEach((listener) => listener(response))
    })

    await expect(provider.request({ method: "quai_chainId" })).resolves.toBe(
      "0x1"
    )
    expect(provider.requestResolvers.size).toBe(0)
  })

  it("rejects and removes the resolver for a disconnected response", async () => {
    const { listeners, postMessage, transport } = createTransport()
    const provider = new PelagusWindowProvider(transport)

    postMessage.mockImplementation((request) => {
      const response: PortResponseEvent = {
        id: request.id,
        jsonrpc: "2.0",
        result: EIP1193_ERROR_CODES.disconnected,
      }
      listeners.forEach((listener) => listener(response))
    })

    await expect(provider.request({ method: "quai_sign" })).rejects.toEqual(
      EIP1193_ERROR_CODES.disconnected
    )
    expect(provider.requestResolvers.size).toBe(0)
    expect(provider.isConnected()).toBe(false)
  })

  it("rejects and removes the resolver when transport sending throws", async () => {
    const { postMessage, transport } = createTransport()
    const provider = new PelagusWindowProvider(transport)
    const transportError = new Error("Port is disconnected")

    postMessage.mockImplementation(() => {
      throw transportError
    })

    await expect(provider.request({ method: "quai_sign" })).rejects.toBe(
      transportError
    )
    expect(provider.requestResolvers.size).toBe(0)
  })
})
