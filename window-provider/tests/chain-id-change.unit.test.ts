import {
  PortResponseEvent,
  ProviderTransport,
  WindowRequestEvent,
} from "@pelagus-provider/provider-bridge-shared"
import PelagusWindowProvider from "../index"

function createProvider(): PelagusWindowProvider {
  const transport = {
    origin: "https://dapp.example",
    postMessage: jest.fn<void, [WindowRequestEvent]>(),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as ProviderTransport

  return new PelagusWindowProvider(transport)
}

describe("PelagusWindowProvider chain id changes", () => {
  it("reports a decimal chain id as hex", () => {
    const provider = createProvider()
    const chainChanged = jest.fn()
    provider.on("chainChanged", chainChanged)

    // net_version answers in decimal; EIP-1193 consumers require hex, and a
    // dApp parsing "15000" as hex would read chain 86016.
    provider.emitChainIdChange("15000")

    expect(provider.chainId).toBe("0x3a98")
    expect(chainChanged).toHaveBeenCalledWith("0x3a98")
  })

  it("keeps hex chain ids as they are, lowercased", () => {
    const provider = createProvider()

    provider.emitChainIdChange("0x3A98")

    expect(provider.chainId).toBe("0x3a98")
  })

  it("emits networkChanged in decimal", () => {
    const provider = createProvider()
    const networkChanged = jest.fn()
    provider.on("networkChanged", networkChanged)

    provider.emitChainIdChange("0x3a98")

    expect(networkChanged).toHaveBeenCalledWith("15000")
  })

  it("ignores an unparseable chain id", () => {
    const provider = createProvider()
    const before = provider.chainId

    provider.emitChainIdChange("not-a-chain")

    expect(provider.chainId).toBe(before)
  })

  it("announces the chain the first response reported, not the built-in default", async () => {
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

    const provider = new PelagusWindowProvider(transport)
    const connect = jest.fn()
    provider.on("connect", connect)

    postMessage.mockImplementation((request) => {
      const response: PortResponseEvent = {
        id: request.id,
        jsonrpc: "2.0",
        result: "0x3a98",
      }
      listeners.forEach((listener) => listener(response))
    })

    await provider.request({ method: "eth_chainId" })

    // A dApp keying off connect must not be handed the placeholder chain.
    expect(connect).toHaveBeenCalledWith({ chainId: "0x3a98" })
  })
})
