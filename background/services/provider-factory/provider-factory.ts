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
    return rpcUrls.includes("https") || rpcUrls.includes("wss")
  }
  return rpcUrls.some((url) => url.includes("https") || url.includes("wss"))
}

export default class ProviderFactory extends BaseService<ProviderFactoryEvents> {
  private lastLocalNodeStatus: boolean | null = null

  private localNodeCheckerInterval: NodeJS.Timeout | null

  private isLocalNodeNetworkProvidersInitialized = false

  private providersForNetworks: Map<string, NetworkProviders> = new Map()

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
    await this.initializeProviders(networks)
  }

  private async initializeProviders(
    networks: NetworkInterface[]
  ): Promise<void> {
    networks.forEach(({ chainID, jsonRpcUrls, webSocketRpcUrls }) => {
      const providersForNetwork = this.providersForNetworks.get(chainID)
      if (providersForNetwork) return

      const usePathingJsonRpc = shouldUsePathingJsonRpc(jsonRpcUrls)
      const usePathingWebSocketRpc = shouldUsePathingJsonRpc(webSocketRpcUrls)

      const jsonRpcProvider = new JsonRpcProvider(jsonRpcUrls, undefined, {
        usePathing: usePathingJsonRpc,
      })

      // Add provider than does not batch requests (useful when dealing with potentially large responses)
      const immediateJsonRpcProvider = new JsonRpcProvider(
        jsonRpcUrls,
        undefined,
        {
          usePathing: usePathingJsonRpc,
          batchMaxCount: 1,
        }
      )
      const webSocketProvider = new WebSocketProvider(
        webSocketRpcUrls,
        undefined,
        {
          usePathing: usePathingWebSocketRpc,
        }
      )

      const ethRpcUrl = `${jsonRpcUrls[0]}/cyprus1`
      const ethJsonRpcProvider = new EthJsonRpcProvider(ethRpcUrl)

      const networkProviders: NetworkProviders = {
        jsonRpcProvider,
        webSocketProvider,
        immediateJsonRpcProvider,
        ethJsonRpcProvider,
      }
      this.providersForNetworks.set(chainID, networkProviders)
    })
  }

  public onShowTestNetworks(): void {
    const testNetworks = PELAGUS_NETWORKS.filter(
      (network) => network.isTestNetwork && !network.isLocalNode
    )
    this.initializeProviders(testNetworks)
    this.startLocalNodeCheckingInterval()
  }

  public onDisableTestNetworks(): void {
    this.stopLocalNodeCheckingInterval()
  }

  public getProvidersForNetwork(networkChainId: string): NetworkProviders {
    const providers = this.providersForNetworks.get(networkChainId)
    if (!providers) {
      throw new Error(`Provider not found for chainID: ${networkChainId}`)
    }
    return providers
  }

  // --------------------------------- local node methods ---------------------------------
  private initializeLocalNodeProviders(): void {
    try {
      // TODO temporary solution due to absence of timeout in providers, uncomment
      // if (this.isLocalNodeNetworkProvidersInitialized) return

      const { chainID, jsonRpcUrls, webSocketRpcUrls } = QuaiLocalNodeNetwork

      // TODO temp solution, delete after provider fix
      this.providersForNetworks.delete(chainID)

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
