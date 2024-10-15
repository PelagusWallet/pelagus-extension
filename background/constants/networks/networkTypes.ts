export interface NetworkInterface {
  chainID: string
  baseAsset: { name: string; symbol: string; decimals: number }
  family: string
  isDisabled: boolean
  isTestNetwork: boolean
  isLocalNode: boolean
  derivationPath?: string
  jsonRpcUrls: string[] | string
  webSocketRpcUrls: string[] | string
  chains: {
    name: string
    shard: string
    blockExplorerUrl: string
    multicall: string
  }[]
  blockExplorerURL?: string
}
