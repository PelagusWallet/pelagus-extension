export interface NetworkInterfaceGA {
  chainID: string
  baseAsset: { name: string; symbol: string; decimals: number }
  family: string
  derivationPath?: string
  rpcUrls: string[] | string
  chains: {
    name: string
    shard: string
    blockExplorerUrl: string
    multicall: string
  }[]
  blockExplorerURL?: string
}
