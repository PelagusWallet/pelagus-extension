import { EventEmitter } from "events"
import {
  PROVIDER_BRIDGE_TARGET,
  WINDOW_PROVIDER_TARGET,
  PELAGUS_WINDOW_PROVIDER_CHAIN_ID,
  PELAGUS_WINDOW_PROVIDER_VERSION,
  PELAGUS_WINDOW_PROVIDER_LABEL,
  PELAGUS_WINDOW_PROVIDER_INJECTED_NAMESPACE,
  PELAGUS_WINDOW_PROVIDER_ICON_URL,
  PELAGUS_WINDOW_PROVIDER_IDENTITY_FLAG,
  ProviderTransport,
  RequestArgument,
  EthersSendCallback,
  PelagusConfigPayload,
  PelagusAccountPayload,
  isObject,
  isWindowResponseEvent,
  isPortResponseEvent,
  isPelagusConfigPayload,
  isEIP1193Error,
  isPelagusInternalCommunication,
  isPelagusAccountPayload,
} from "@pelagus-provider/provider-bridge-shared"

type ProviderInfo = {
  label: string
  version: number
  injectedNamespace: string
  iconURL: string
  identityFlag?: string
  checkIdentity?: (provider: WalletProvider) => boolean
}

const providerInfo: ProviderInfo = {
  label: PELAGUS_WINDOW_PROVIDER_LABEL,
  version: PELAGUS_WINDOW_PROVIDER_VERSION,
  injectedNamespace: PELAGUS_WINDOW_PROVIDER_INJECTED_NAMESPACE,
  iconURL: PELAGUS_WINDOW_PROVIDER_ICON_URL,
  identityFlag: PELAGUS_WINDOW_PROVIDER_IDENTITY_FLAG,
  checkIdentity: (provider: WalletProvider) =>
    !!provider && !!provider.isPelagus,
}

export default class PelagusWindowProvider extends EventEmitter {
  chainId = PELAGUS_WINDOW_PROVIDER_CHAIN_ID

  selectedAddress: string | undefined

  connected = false

  isPelagus = true

  isMetaMask = false

  pelagusSetAsDefault = false

  isWeb3 = true

  requestResolvers = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (value: unknown) => void
      sendData: {
        id: string
        target: string
        request: Required<RequestArgument>
      }
    }
  >()

  providerInfo = providerInfo

  private requestID = 0n

  constructor(public transport: ProviderTransport) {
    super()

    this.request = this.request.bind(this)
    this.transport.addEventListener(this.backgroundEventsListener.bind(this))
    this.transport.addEventListener(this.backgroundResponsesListener.bind(this))
  }

  private backgroundEventsListener(event: unknown): void {
    let result: PelagusConfigPayload | PelagusAccountPayload

    if (
      isWindowResponseEvent(event) &&
      isPelagusInternalCommunication(event.data)
    ) {
      if (
        event.origin !== this.transport.origin || // filter to messages claiming to be from the provider-bridge script
        event.source !== window || // we want to receive messages only from the provider-bridge script
        event.data.target !== WINDOW_PROVIDER_TARGET
      )
        return
      ;({ result } = event.data)
    } else if (
      isPortResponseEvent(event) &&
      isPelagusInternalCommunication(event)
    ) {
      ;({ result } = event)
    } else {
      return
    }

    if (isPelagusConfigPayload(result)) {
      window.walletRouter?.shouldSetPelagusForCurrentProvider(
        result.defaultWallet,
        result.shouldReload
      )

      if (result.chainId && result.chainId !== this.chainId) {
        this.emitChainIdChange(result.chainId)
      }
    } else if (isPelagusAccountPayload(result)) {
      this.emitAddressChange(result.address)
    }
  }

  private backgroundResponsesListener(event: unknown): void {
    let id
    let result: unknown

    if (isWindowResponseEvent(event)) {
      if (
        event.origin !== this.transport.origin || // filter to messages claiming to be from the provider-bridge script
        event.source !== window || // we want to receive messages only from the provider-bridge script
        event.data.target !== WINDOW_PROVIDER_TARGET
      )
        return
      ;({ id, result } = event.data)
    } else if (isPortResponseEvent(event)) {
      ;({ id, result } = event)
    } else {
      return
    }

    const requestResolver = this.requestResolvers.get(id)
    if (!requestResolver) return

    const { sendData, reject, resolve } = requestResolver

    this.requestResolvers.delete(sendData.id)

    const { method: sentMethod } = sendData.request

    if (isEIP1193Error(result)) {
      reject(result)
    }

    if (!this.connected) {
      this.connected = true
      this.emit("connect", { chainId: this.chainId })
    }

    this.handleResponseByMethod(sentMethod, result, sendData)

    resolve(result)
  }

  private handleResponseByMethod(
    method: string,
    result: unknown,
    sendData: any
  ): void {
    switch (method) {
      case "wallet_addEthereumChain":
      case "wallet_switchEthereumChain":
        // null result indicates successful chain change EIP-3326
        if (result === null) {
          this.emitChainIdChange(
            (sendData.request.params[0] as { chainId: string }).chainId
          )
        }
        break
      case "net_version":
      case "quai_chainId":
        if (
          typeof result === "string" &&
          Number(this.chainId) !== Number(result)
        ) {
          this.emitChainIdChange(result)
        }
        break
      case "quai_accounts":
      case "quai_requestAccounts":
        if (Array.isArray(result) && result.length !== 0) {
          this.emitAddressChange(result)
        }
        break
      default:
        break
    }
  }

  emitChainIdChange(chainId: string): void {
    this.chainId = chainId
    this.emit("chainChanged", chainId)
    this.emit("networkChanged", Number(chainId).toString())
  }

  emitAddressChange(address: Array<string>): void {
    if (this.selectedAddress !== address[0]) {
      this.selectedAddress = address[0]
      this.emit("accountsChanged", address)
    }
  }

  // Methods listed below are accessible to dApps for interaction
  isConnected(): boolean {
    return this.connected
  }

  // deprecated EIP-1193 method
  async enable(): Promise<unknown> {
    return this.request({ method: "quai_requestAccounts" })
  }

  // deprecated EIP1193 send for web3-react injected provider
  send(method: string, params: Array<unknown>): Promise<unknown>
  // deprecated EIP1193 send for ethers.js Web3Provider > ExternalProvider
  send(
    request: RequestArgument,
    callback: (error: unknown, response: unknown) => void
  ): void
  send(
    methodOrRequest: string | RequestArgument,
    paramsOrCallback: Array<unknown> | EthersSendCallback
  ): Promise<unknown> | void {
    if (
      typeof methodOrRequest === "string" &&
      typeof paramsOrCallback !== "function"
    ) {
      return this.request({ method: methodOrRequest, params: paramsOrCallback })
    }

    if (isObject(methodOrRequest) && typeof paramsOrCallback === "function") {
      return this.sendAsync(methodOrRequest, paramsOrCallback)
    }

    return Promise.reject(new Error("Unsupported function parameters"))
  }

  // deprecated EIP-1193 method
  sendAsync(
    request: RequestArgument & { id?: number; jsonrpc?: string },
    callback: (error: unknown, response: unknown) => void
  ): Promise<unknown> | void {
    return this.request(request).then(
      (response) =>
        callback(null, {
          result: response,
          id: request.id,
          jsonrpc: request.jsonrpc,
        }),
      (error) => callback(error, null)
    )
  }

  request(arg: RequestArgument): Promise<unknown> {
    const { method, params = [] } = arg

    const sendData = {
      id: this.requestID.toString(),
      target: PROVIDER_BRIDGE_TARGET,
      request: {
        method,
        params,
      },
    }

    this.requestID += 1n
    this.transport.postMessage(sendData)

    return new Promise<unknown>((resolve, reject) => {
      this.requestResolvers.set(sendData.id, {
        resolve,
        reject,
        sendData,
      })
    })
  }
}
