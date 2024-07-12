import { JsonRpcProvider, WebSocketProvider } from "quais"

import { NetworkInterfaceGA } from "../../constants/networks/networkTypes"

// class responsible for managing providers only!
// it will initialize networks
// give ability to getProvider and so on.....
export default class ProviderFactory {
  // instead of JsonRpcProvider or WebSocketProvider we can think about
  // using high level Provider class that will replace both types
  // it is always better to have one type, but with shared methods/properties

  // 1. replacement of this.UrlToProvider in main class
  // 2. we can use Map here if Map faster than just an array
  // + Map has build in methods like has()... need to think........
  // 3. once again, need to think how to
  private providers: {
    [chainID: string]: {
      jsonRpc: JsonRpcProvider
      websocket: WebSocketProvider
    }
  } = {}

  public initializeNetworks(networks: NetworkInterfaceGA[]): void {
    networks.forEach((network) => {
      const { chainID, rpcUrls } = network

      if (!this.providers[chainID]) {
        this.providers[chainID] = {
          jsonRpc: new JsonRpcProvider(rpcUrls),
          websocket: new WebSocketProvider(rpcUrls),
        }

        // after obtaining provider, we can perform health check
        // to make sure that everything is okay, especially for local node
        // which will definitely fix our errorinitializeNetworks

        // we need to handle WebSocket too
      }
    })
  }

  // 1. in this function is better to also check if provider exists, if not, try to create it
  // 2. it is better to receive network as a param here, need to think.......
  public getProvider(network: NetworkInterfaceGA): {
    jsonRpc: JsonRpcProvider
    websocket: WebSocketProvider
  } {
    return this.providers[network.chainID]
  }

  // need to create a function which will check health of provider,
  // so we can use this function in getProvider() and initializeNetworks()
}
