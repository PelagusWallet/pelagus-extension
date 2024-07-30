import { QUAI_SCAN_URL } from "../networks"
import { NetworkInterface } from "./networkTypes"

export const DEFAULT_PELAGUS_NETWORK = {
  chainID: "9000",
  baseAsset: { name: "Quai Network", symbol: "QUAI", decimals: 18 },
  family: "EVM",
  isDisabled: false,
  isTestNetwork: false,
  jsonRpcUrls: ["http://rpc.sandbox.quai.network"],
  webSocketRpcUrls: ["ws://rpc.sandbox.quai.network"],
  blockExplorerURL: "",
  chains: [
    {
      name: "Cyprus One",
      shard: "cyprus-1",
      blockExplorerUrl: "https://cyprus1.colosseum.quaiscan.io",
      multicall: "",
    },
    {
      name: "Cyprus Two",
      shard: "cyprus-2",
      blockExplorerUrl: "https://cyprus2.colosseum.quaiscan.io",
      multicall: "",
    },
    {
      name: "Cyprus Three",
      shard: "cyprus-3",
      blockExplorerUrl: "https://cyprus3.colosseum.quaiscan.io",
      multicall: "",
    },
    {
      name: "Paxos One",
      shard: "paxos-1",
      blockExplorerUrl: "https://paxos1.colosseum.quaiscan.io",
      multicall: "",
    },
    {
      name: "Paxos Two",
      shard: "paxos-2",
      blockExplorerUrl: "https://paxos2.colosseum.quaiscan.io",
      multicall: "",
    },
    {
      name: "Paxos Three",
      shard: "paxos-3",
      blockExplorerUrl: "https://paxos3.colosseum.quaiscan.io",
      multicall: "",
    },
    {
      name: "Hydra One",
      shard: "hydra-1",
      blockExplorerUrl: "https://hydra1.colosseum.quaiscan.io",
      multicall: "",
    },
    {
      name: "Hydra Two",
      shard: "hydra-2",
      blockExplorerUrl: "https://hydra2.colosseum.quaiscan.io",
      multicall: "",
    },
    {
      name: "Hydra Three",
      shard: "hydra-3",
      blockExplorerUrl: "https://hydra3.colosseum.quaiscan.io",
      multicall: "",
    },
  ],
}

export const QuaiGoldenAgeTestnet: NetworkInterface = {
  chainID: "9000",
  baseAsset: { name: "Quai Network", symbol: "QUAI", decimals: 18 },
  family: "EVM",
  isDisabled: false,
  isTestNetwork: false,
  jsonRpcUrls: ["http://rpc.sandbox.quai.network"],
  webSocketRpcUrls: ["ws://rpc.sandbox.quai.network"],
  blockExplorerURL: QUAI_SCAN_URL,
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

export const QuaiLocalNodeNetwork: NetworkInterface = {
  chainID: "1337",
  baseAsset: { name: "Quai Network Local", symbol: "QUAI", decimals: 18 },
  family: "EVM",
  isDisabled: true,
  isTestNetwork: true,
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

export const NetworksArray = [QuaiGoldenAgeTestnet, QuaiLocalNodeNetwork]
