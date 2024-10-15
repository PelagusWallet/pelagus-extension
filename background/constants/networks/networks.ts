import { QUAI_SCAN_URL, ORCHARD_QUAI_SCAN_URL } from "../networks"
import { NetworkInterface } from "./networkTypes"

export const QuaiGoldenAgeTestnet: NetworkInterface = {
  chainID: "9000",
  baseAsset: { name: "Quai Network", symbol: "QUAI", decimals: 18 },
  family: "EVM",
  isDisabled: false,
  isTestNetwork: false,
  isLocalNode: false,
  jsonRpcUrls: ["https://rpc.quai.network"],
  webSocketRpcUrls: ["wss://rpc.quai.network"],
  blockExplorerURL: QUAI_SCAN_URL,
  chains: [
    {
      name: "Cyprus One",
      shard: "cyprus-1",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
  ],
}

export const QuaiOrchardTestnet: NetworkInterface = {
  chainID: "15000",
  baseAsset: { name: "Quai Network Orchard", symbol: "QUAI", decimals: 18 },
  family: "EVM",
  isDisabled: false,
  isTestNetwork: true,
  isLocalNode: false,
  jsonRpcUrls: ["https://rpc.orchard.quai.network"],
  webSocketRpcUrls: ["wss://rpc.orchard.quai.network"],
  blockExplorerURL: ORCHARD_QUAI_SCAN_URL,
  chains: [
    {
      name: "Cyprus One",
      shard: "cyprus-1",
      blockExplorerUrl: ORCHARD_QUAI_SCAN_URL,
      multicall: "",
    },
  ],
}

export const QuaiLocalNodeNetwork: NetworkInterface = {
  chainID: "17000",
  baseAsset: { name: "Quai Network Local", symbol: "QUAI", decimals: 18 },
  family: "EVM",
  isDisabled: true,
  isTestNetwork: true,
  isLocalNode: true,
  jsonRpcUrls: ["http://localhost"],
  webSocketRpcUrls: ["ws://localhost"],
  blockExplorerURL: "",
  chains: [
    {
      name: "Cyprus One",
      shard: "cyprus-1",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
    {
      name: "Cyprus Two",
      shard: "cyprus-2",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
    {
      name: "Cyprus Three",
      shard: "cyprus-3",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
    {
      name: "Paxos One",
      shard: "paxos-1",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
    {
      name: "Paxos Two",
      shard: "paxos-2",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
    {
      name: "Paxos Three",
      shard: "paxos-3",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
    {
      name: "Hydra One",
      shard: "hydra-1",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
    {
      name: "Hydra Two",
      shard: "hydra-2",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
    {
      name: "Hydra Three",
      shard: "hydra-3",
      blockExplorerUrl: QUAI_SCAN_URL,
      multicall: "",
    },
  ],
}

export const DEFAULT_PELAGUS_NETWORK = QuaiGoldenAgeTestnet

export const PELAGUS_NETWORKS = [
  QuaiGoldenAgeTestnet,
  QuaiOrchardTestnet,
  QuaiLocalNodeNetwork,
]
