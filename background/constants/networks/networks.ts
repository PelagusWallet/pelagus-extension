import { QUAI_SCAN_URL } from "../networks"
import { NetworkInterface } from "./networkTypes"

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
  chainID: "17000",
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

export const DEFAULT_PELAGUS_NETWORK = QuaiGoldenAgeTestnet

export const NetworksArray = [QuaiGoldenAgeTestnet, QuaiLocalNodeNetwork]
