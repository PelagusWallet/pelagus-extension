import { JsonRpcProvider, WebSocketProvider } from "quais"
import { JsonRpcProvider as EthJsonRpcProvider } from "ethers"
export type NetworkProviders = {
  jsonRpcProvider: JsonRpcProvider
  webSocketProvider: WebSocketProvider
  immediateJsonRpcProvider?: JsonRpcProvider
  ethJsonRpcProvider?: EthJsonRpcProvider
}
