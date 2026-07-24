import { JsonRpcProvider, WebSocketProvider } from "quais"
import { JsonRpcProvider as EthJsonRpcProvider } from "ethers"
import BaseService from "../base"
import { NetworkProviders } from "./types"
import { ServiceCreatorFunction } from "../types"
import ProviderFactoryEvents from "./events"
import {
  PELAGUS_NETWORKS,
  QuaiLocalNodeNetwork,
} from "../../constants/networks/networks"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import PreferenceService from "../preferences"

// TODO temp solution instead of provider timeout
const DEFAULT_LOCAL_NODE_CHECK_INTERVAL_IN_MS = 7000

const shouldUsePathingJsonRpc = (rpcUrls: string | string[]) => {
  if (typeof rpcUrls === "string") {
    // Don't use pathing if the URL already contains a path (like "/cyprus1" or "/ws/cyprus1")
    if (rpcUrls.includes("/", 8)) {
      // Skip protocol part (https://)
      return false
    }
    return rpcUrls.includes("https") || rpcUrls.includes("wss")
  }
  return rpcUrls.some((url) => {
    // Don't use pathing if the URL already contains a path (like "/cyprus1" or "/ws/cyprus1")
    if (url.includes("/", 8)) {
      // Skip protocol part (https://)
      return false
    }
    return url.includes("https") || url.includes("wss")
  })
}

export default class ProviderFactory extends BaseService<ProviderFactoryEvents> {
  private lastLocalNodeStatus: boolean | null = null

  private localNodeCheckerInterval: NodeJS.Timeout | null

  private isLocalNodeNetworkProvidersInitialized = false

  private providersForNetworks: Map<string, NetworkProviders> = new Map()

  private providerConfigByNetwork: Map<string, string> = new Map()

  static create: ServiceCreatorFunction<
    ProviderFactoryEvents,
    ProviderFactory,
    [Promise<PreferenceService>]
  > = async (preferenceService) => {
    return new this(await preferenceService)
  }

  private constructor(private preferenceService: PreferenceService) {
    super()
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()

    const networks = PELAGUS_NETWORKS.filter(
      (network) => !network.isTestNetwork && !network.isLocalNode
    )
    this.initializeProviders(networks)
  }

  private initializeProviders(networks: NetworkInterface[]): void {
    networks.forEach(({ chainID, jsonRpcUrls, webSocketRpcUrls }) => {
      // Check for custom RPC URLs from Redux store
      let customJsonRpcUrls = jsonRpcUrls
      let customWebSocketRpcUrls = webSocketRpcUrls

      if (globalThis.main?.store) {
        const state = globalThis.main.store.getState()
        // Convert chainID to number for customRPCs lookup
        const chainIdNumber = Number(chainID)
        const customRPC = state.networks?.customRPCs?.[chainIdNumber]

        if (customRPC) {
          // Use custom RPC URLs if provided
          customJsonRpcUrls = [customRPC.httpRpcUrl]
          customWebSocketRpcUrls = [customRPC.wsRpcUrl]
        }
      }

      const configKey = JSON.stringify([
        Array.isArray(customJsonRpcUrls)
          ? customJsonRpcUrls
          : [customJsonRpcUrls],
        Array.isArray(customWebSocketRpcUrls)
          ? customWebSocketRpcUrls
          : [customWebSocketRpcUrls],
      ])
      const providersForNetwork = this.providersForNetworks.get(chainID)
      if (
        providersForNetwork &&
        this.providerConfigByNetwork.get(chainID) === configKey
      ) {
        return
      }

      const usePathingJsonRpc = shouldUsePathingJsonRpc(customJsonRpcUrls)
      const usePathingWebSocketRpc = shouldUsePathingJsonRpc(
        customWebSocketRpcUrls
      )

      const jsonRpcProvider = new JsonRpcProvider(
        customJsonRpcUrls,
        undefined,
        {
          usePathing: usePathingJsonRpc,
        }
      )

      // Add provider than does not batch requests (useful when dealing with potentially large responses)
      const immediateJsonRpcProvider = new JsonRpcProvider(
        customJsonRpcUrls,
        undefined,
        {
          usePathing: usePathingJsonRpc,
          batchMaxCount: 1,
        }
      )
      const webSocketProvider = new WebSocketProvider(
        customWebSocketRpcUrls,
        undefined,
        {
          usePathing: usePathingWebSocketRpc,
        }
      )

      const baseUrl = Array.isArray(customJsonRpcUrls)
        ? customJsonRpcUrls[0]
        : customJsonRpcUrls
      const ethRpcUrl = baseUrl.endsWith("/cyprus1")
        ? baseUrl
        : `${baseUrl}/cyprus1`
      const ethJsonRpcProvider = new EthJsonRpcProvider(ethRpcUrl)

      const networkProviders: NetworkProviders = {
        jsonRpcProvider,
        webSocketProvider,
        immediateJsonRpcProvider,
        ethJsonRpcProvider,
      }
      this.providersForNetworks.set(chainID, networkProviders)
      this.providerConfigByNetwork.set(chainID, configKey)
      if (providersForNetwork)
        ProviderFactory.destroyProviders(providersForNetwork)
    })
  }

  private static destroyProviders(providers: NetworkProviders): void {
    providers.jsonRpcProvider.destroy()
    providers.immediateJsonRpcProvider?.destroy()
    providers.ethJsonRpcProvider?.destroy()

    // Quais reconnects every socket closed by WebSocketProvider.destroy().
    // Clear the close handlers first so intentional cleanup stays intentional.
    providers.webSocketProvider.websocket.forEach((socket) => {
      Object.assign(socket, { onclose: null })
    })
    providers.webSocketProvider.destroy().catch(() => undefined)
  }

  protected override async internalStopService(): Promise<void> {
    this.stopLocalNodeCheckingInterval()
    this.providersForNetworks.forEach((providers) =>
      ProviderFactory.destroyProviders(providers)
    )
    this.providersForNetworks.clear()
    this.providerConfigByNetwork.clear()
    await super.internalStopService()
  }

  public onShowTestNetworks(): void {
    const testNetworks = PELAGUS_NETWORKS.filter(
      (network) => network.isTestNetwork && !network.isLocalNode
    )
    this.initializeProviders(testNetworks)
    // Don't automatically start local node checking - only when local network is actually selected
  }

  public onDisableTestNetworks(): void {
    this.stopLocalNodeCheckingInterval()
  }

  public hasProvidersForNetwork(networkChainId: string): boolean {
    return this.providersForNetworks.has(networkChainId)
  }

  public getProvidersForNetwork(networkChainId: string): NetworkProviders {
    // Check if this is the local network and start local node checking if needed
    if (networkChainId === QuaiLocalNodeNetwork.chainID) {
      if (!this.localNodeCheckerInterval) {
        console.log(
          `[ProviderFactory] Starting local node checking for chain ${networkChainId}`
        )
        this.startLocalNodeCheckingInterval()
      }
    }

    const network = PELAGUS_NETWORKS.find(
      ({ chainID }) => chainID === networkChainId
    )
    if (network && this.providersForNetworks.has(networkChainId)) {
      this.initializeProviders([network])
    }

    const providers = this.providersForNetworks.get(networkChainId)
    if (!providers) {
      throw new Error(`Provider not found for chainID: ${networkChainId}`)
    }
    return providers
  }

  public refreshProvidersForNetwork(networkChainId: string): void {
    const network = PELAGUS_NETWORKS.find(
      ({ chainID }) => chainID === networkChainId
    )
    if (network) this.initializeProviders([network])
  }

  // --------------------------------- local node methods ---------------------------------
  private initializeLocalNodeProviders(): void {
    try {
      // TODO temporary solution due to absence of timeout in providers, uncomment
      // if (this.isLocalNodeNetworkProvidersInitialized) return

      const { chainID, jsonRpcUrls, webSocketRpcUrls } = QuaiLocalNodeNetwork

      const existingProviders = this.providersForNetworks.get(chainID)

      const jsonRpcProvider = new JsonRpcProvider(jsonRpcUrls, undefined, {
        usePathing: false,
      })
      const webSocketProvider = new WebSocketProvider(
        webSocketRpcUrls,
        undefined,
        { usePathing: false }
      )

      const localNodeNetworkProviders: NetworkProviders = {
        jsonRpcProvider,
        webSocketProvider,
      }
      this.providersForNetworks.set(chainID, localNodeNetworkProviders)
      this.providerConfigByNetwork.set(
        chainID,
        JSON.stringify([jsonRpcUrls, webSocketRpcUrls])
      )
      if (existingProviders) ProviderFactory.destroyProviders(existingProviders)

      this.isLocalNodeNetworkProvidersInitialized = true
      this.lastLocalNodeStatus = null

      // slight improvement to check local node status immediately after toggle click
      // optional: we can wait DEFAULT_LOCAL_NODE_CHECK_INTERVAL_IN_MS delay or force check
      this.checkLocalNodeStatus()
    } catch (error) {
      console.error("Error initializing local node providers", error)
    }
  }

  private async checkLocalNodeStatus(): Promise<boolean> {
    const fetchLocalBlockHash = async () => {
      try {
        const response = await fetch("http://localhost:9001", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "quai_getBlockByNumber",
            params: ["latest", false],
          }),
        })

        const data = await response.json()
        return data.result.hash
      } catch (error) {
        return null
      }
    }

    try {
      const timeout = (ms: number) =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), ms)
        )

      const blockHash = await Promise.race([
        fetchLocalBlockHash(),
        timeout(DEFAULT_LOCAL_NODE_CHECK_INTERVAL_IN_MS),
      ])

      const isDisabled = !blockHash
      this.emitLocalNodeStatusEvent(isDisabled)
      return !isDisabled
    } catch (error) {
      this.emitLocalNodeStatusEvent(true)
      return false
    }
  }

  private emitLocalNodeStatusEvent(isDisabled: boolean): void {
    if (this.lastLocalNodeStatus === isDisabled) return

    this.lastLocalNodeStatus = isDisabled

    this.emitter.emit("localNodeNetworkStatus", {
      isDisabled,
      localNodeNetworkChainId: QuaiLocalNodeNetwork.chainID,
    })
  }

  private startLocalNodeCheckingInterval(
    intervalMs = DEFAULT_LOCAL_NODE_CHECK_INTERVAL_IN_MS
  ): void {
    if (this.localNodeCheckerInterval) return

    // Check immediately and only initialize providers if node is available
    this.checkLocalNodeStatus().then((nodeAvailable) => {
      if (nodeAvailable) {
        this.initializeLocalNodeProviders()
      }
    })

    this.localNodeCheckerInterval = setInterval(async () => {
      const nodeAvailable = await this.checkLocalNodeStatus()
      if (nodeAvailable && !this.isLocalNodeNetworkProvidersInitialized) {
        this.initializeLocalNodeProviders()
      }
    }, intervalMs)
  }

  private stopLocalNodeCheckingInterval(): void {
    if (!this.localNodeCheckerInterval) return

    clearInterval(this.localNodeCheckerInterval)
    this.localNodeCheckerInterval = null
  }
}
