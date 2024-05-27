import { indexOf } from "lodash"
import logger from "../lib/logger"
import { QUAI, QUAI_LOCAL } from "./"
import { EVMNetwork } from "../networks"
import {
  JsonRpcProvider as QuaisJsonRpcProvider,
  WebSocketProvider as QuaisWebSocketProvider,
} from "@quais/providers"
import SerialFallbackProvider from "../services/chain/serial-fallback-provider"

export const VALID_SHARDS: Array<string> = [
  "cyprus-1",
  "cyprus-2",
  "cyprus-3",
  "paxos-1",
  "paxos-2",
  "paxos-3",
  "hydra-1",
  "hydra-2",
  "hydra-3",
]
export const VALID_SHARDS_NAMES: Array<string> = [
  "Cyprus 1",
  "Cyprus 2",
  "Cyprus 3",
  "Paxos 1",
  "Paxos 2",
  "Paxos 3",
  "Hydra 1",
  "Hydra 2",
  "Hydra 3",
]

export const DEFAULT_QUAI_TESTNET = {
  name: "Colosseum",
  chainCode: 994,
  chainID: 9000,
  isCustom: false,
  chains: [
    {
      name: "Cyprus One",
      shard: "cyprus-1",
      rpc: "https://rpc.cyprus1.colosseum.quaiscan.io",
      blockExplorerUrl: "https://cyprus1.colosseum.quaiscan.io",
    },
    {
      name: "Cyprus Two",
      shard: "cyprus-2",
      rpc: "https://rpc.cyprus2.colosseum.quaiscan.io",
      blockExplorerUrl: "https://cyprus2.colosseum.quaiscan.io",
    },
    {
      name: "Cyprus Three",
      shard: "cyprus-3",
      rpc: "https://rpc.cyprus3.colosseum.quaiscan.io",
      blockExplorerUrl: "https://cyprus3.colosseum.quaiscan.io",
    },
    {
      name: "Paxos One",
      shard: "paxos-1",
      rpc: "https://rpc.paxos1.colosseum.quaiscan.io",
      blockExplorerUrl: "https://paxos1.colosseum.quaiscan.io",
    },
    {
      name: "Paxos Two",
      shard: "paxos-2",
      rpc: "https://rpc.paxos2.colosseum.quaiscan.io",
      blockExplorerUrl: "https://paxos2.colosseum.quaiscan.io",
    },
    {
      name: "Paxos Three",
      shard: "paxos-3",
      rpc: "https://rpc.paxos3.colosseum.quaiscan.io",
      blockExplorerUrl: "https://paxos3.colosseum.quaiscan.io",
    },
    {
      name: "Hydra One",
      shard: "hydra-1",
      rpc: "https://rpc.hydra1.colosseum.quaiscan.io",
      blockExplorerUrl: "https://hydra1.colosseum.quaiscan.io",
    },
    {
      name: "Hydra Two",
      shard: "hydra-2",
      rpc: "https://rpc.hydra2.colosseum.quaiscan.io",
      blockExplorerUrl: "https://hydra2.colosseum.quaiscan.io",
    },
    {
      name: "Hydra Three",
      shard: "hydra-3",
      rpc: "https://rpc.hydra3.colosseum.quaiscan.io",
      blockExplorerUrl: "https://hydra3.colosseum.quaiscan.io",
    },
  ],
} as Network

export const DEFAULT_QUAI_DEVNET = {
  name: "Garden",
  chainCode: 994,
  chainID: 12000,
  isCustom: false,
  chains: [
    {
      name: "Cyprus One",
      shard: "cyprus-1",
      rpc: "https://rpc.cyprus1.garden.quaiscan.io",
      blockExplorerUrl: "https://cyprus1.garden.quaiscan.io",
    },
    {
      name: "Cyprus Two",
      shard: "cyprus-2",
      rpc: "https://rpc.cyprus2.garden.quaiscan.io",
      blockExplorerUrl: "https://cyprus2.garden.quaiscan.io",
    },
    {
      name: "Cyprus Three",
      shard: "cyprus-3",
      rpc: "https://rpc.cyprus3.garden.quaiscan.io",
      blockExplorerUrl: "https://cyprus3.garden.quaiscan.io",
    },
    {
      name: "Paxos One",
      shard: "paxos-1",
      rpc: "https://rpc.paxos1.garden.quaiscan.io",
      blockExplorerUrl: "https://paxos1.garden.quaiscan.io",
    },
    {
      name: "Paxos Two",
      shard: "paxos-2",
      rpc: "https://rpc.paxos2.garden.quaiscan.io",
      blockExplorerUrl: "https://paxos2.garden.quaiscan.io",
    },
    {
      name: "Paxos Three",
      shard: "paxos-3",
      rpc: "https://rpc.paxos3.garden.quaiscan.io",
      blockExplorerUrl: "https://paxos3.garden.quaiscan.io",
    },
    {
      name: "Hydra One",
      shard: "hydra-1",
      rpc: "https://rpc.hydra1.garden.quaiscan.io",
      blockExplorerUrl: "https://hydra1.garden.quaiscan.io",
    },
    {
      name: "Hydra Two",
      shard: "hydra-2",
      rpc: "https://rpc.hydra2.garden.quaiscan.io",
      blockExplorerUrl: "https://hydra2.garden.quaiscan.io",
    },
    {
      name: "Hydra Three",
      shard: "hydra-3",
      rpc: "https://rpc.hydra3.garden.quaiscan.io",
      blockExplorerUrl: "https://hydra3.garden.quaiscan.io",
    },
  ],
} as Network

export const DEFAULT_QUAI_LOCAL = {
  name: "Local",
  chainCode: 994,
  chainID: 1337,
  isCustom: false,
  chains: [
    {
      name: "Cyprus One",
      shard: "cyprus-1",
      rpc: "http://localhost:8610",
      blockExplorerUrl: "https://dev.cyprus1.quaiscan.io",
      multicall: "0x15b6351eDEcd7142ac4c6fE54948b603D4566862",
    },
    {
      name: "Cyprus Two",
      shard: "cyprus-2",
      rpc: "http://localhost:8542",
      blockExplorerUrl: "https://dev.cyprus2.quaiscan.io",
      multicall: "0x2F3e12280232410e9454254E6152814ce677475B",
    },
    {
      name: "Cyprus Three",
      shard: "cyprus-3",
      rpc: "http://localhost:8674",
      blockExplorerUrl: "https://dev.cyprus3.quaiscan.io",
      multicall: "0x3E4CE31D864BD3CC05E57F6f2a8967e6EF53039b",
    },
    {
      name: "Paxos One",
      shard: "paxos-1",
      rpc: "http://localhost:8512",
      blockExplorerUrl: "https://dev.paxos1.quaiscan.io",
      multicall: "0x729f4724eA02904086b8ce2889959d4aC96127ef",
    },
    {
      name: "Paxos Two",
      shard: "paxos-2",
      rpc: "http://localhost:8544",
      blockExplorerUrl: "https://dev.paxos2.quaiscan.io",
      multicall: "0x84FA6Abf2E7a743719f59E6EF82248cD1C53e621",
    },
    {
      name: "Paxos Three",
      shard: "paxos-3",
      rpc: "http://localhost:8576",
      blockExplorerUrl: "https://dev.paxos3.quaiscan.io",
      multicall: "0x9b05beAA009A7418EC6825452269E7Dfc82777Ce",
    },
    {
      name: "Hydra One",
      shard: "hydra-1",
      rpc: "http://localhost:8614",
      blockExplorerUrl: "https://dev.hydra1.quaiscan.io",
      multicall: "0xc256fc8DA480034E0339A6AC9c38913cC018A505",
    },
    {
      name: "Hydra Two",
      shard: "hydra-2",
      rpc: "http://localhost:8646",
      blockExplorerUrl: "https://dev.hydra2.quaiscan.io",
      multicall: "0xCb9fe98f7c8739B7272d27259747320096610569",
    },
    {
      name: "Hydra Three",
      shard: "hydra-3",
      rpc: "http://localhost:8678",
      blockExplorerUrl: "https://dev.hydra3.quaiscan.io",
      multicall: "0xFB17d5ea1a7e1132E2b12FA7B03cABcb144CDb9d",
    },
  ],
} as Network

export const QUAI_NETWORK: EVMNetwork = {
  name: "Quai Network",
  baseAsset: QUAI,
  chainID: "9000",
  family: "EVM",
  chains: DEFAULT_QUAI_TESTNET.chains,
  derivationPath: "m/44'/1'/0'/0",
  isQuai: true,
}

export const QUAI_NETWORK_LOCAL: EVMNetwork = {
  name: "Quai Network Local",
  baseAsset: QUAI_LOCAL,
  chainID: "1337",
  family: "EVM",
  chains: DEFAULT_QUAI_LOCAL.chains,
  derivationPath: "m/44'/1'/0'/0",
  isQuai: true,
}

export const DEFAULT_NETWORKS = [QUAI_NETWORK]
export const DEFAULT_TEST_NETWORKS = [QUAI_NETWORK_LOCAL]

export function isBuiltInNetwork(network: EVMNetwork): boolean {
  return DEFAULT_NETWORKS.some(
    (builtInNetwork) => builtInNetwork.chainID === network.chainID
  )
}

export function isTestNetwork(network: EVMNetwork): boolean {
  return DEFAULT_TEST_NETWORKS.some(
    (testNetwork) => testNetwork.chainID === network.chainID
  )
}

export const DEFAULT_NETWORKS_BY_CHAIN_ID = new Set(
  DEFAULT_NETWORKS.map((network) => network.chainID)
)

export const EIP_1559_COMPLIANT_CHAIN_IDS = new Set(
  [QUAI_NETWORK, QUAI_NETWORK_LOCAL].map((network) => network.chainID)
)

export const CHAINS_WITH_MEMPOOL = new Set(
  [QUAI_NETWORK, QUAI_NETWORK_LOCAL].map((network) => network.chainID)
)

export const NETWORK_BY_CHAIN_ID = {
  [QUAI_NETWORK.chainID]: QUAI_NETWORK,
  [QUAI_NETWORK_LOCAL.chainID]: QUAI_NETWORK_LOCAL,
}
export const TEST_NETWORK_BY_CHAIN_ID = new Set(
  DEFAULT_TEST_NETWORKS.map((network) => network.chainID)
)

// Network class contains data about a default or custom network.
export class Network {
  name: string
  chains: ChainData[]
  isCustom: boolean
  chainCode: number
  chainID: number
}

export class ChainData {
  name: string
  shard: string
  blockExplorerUrl: string
  rpc: string
  multicall: string
}

export const NUM_ZONES_IN_REGION = 3
export const NUM_REGIONS_IN_PRIME = 3

export const DEFAULT_QUAI_NETWORKS = [
  DEFAULT_QUAI_TESTNET,
  DEFAULT_QUAI_DEVNET,
  DEFAULT_QUAI_LOCAL,
]

export const QUAI_CONTEXTS = [
  {
    name: "Cyprus One",
    shard: "cyprus-1",
    context: 2,
    byte: ["00", "1D"],
  },
  {
    name: "Cyprus Two",
    shard: "cyprus-2",
    context: 2,
    byte: ["1E", "3A"],
  },
  {
    name: "Cyprus Three",
    shard: "cyprus-3",
    context: 2,
    byte: ["3B", "57"],
  },
  {
    name: "Paxos One",
    shard: "paxos-1",
    context: 2,
    byte: ["58", "73"],
  },
  {
    name: "Paxos Two",
    shard: "paxos-2",
    context: 2,
    byte: ["74", "8F"],
  },
  {
    name: "Paxos Three",
    shard: "paxos-3",
    context: 2,
    byte: ["90", "AB"],
  },
  {
    name: "Hydra One",
    shard: "hydra-1",
    context: 2,
    byte: ["AC", "C7"],
  },
  {
    name: "Hydra Two",
    shard: "hydra-2",
    context: 2,
    byte: ["C8", "E3"],
  },
  {
    name: "Hydra Three",
    shard: "hydra-3",
    context: 2,
    byte: ["E4", "FF"],
  },
]

export const CHAIN_ID_TO_RPC_URLS: {
  [chainId: string]: Array<string> | undefined
} = {
  [QUAI_NETWORK.chainID]: [
    ...DEFAULT_QUAI_TESTNET.chains.map((chain) => chain.rpc),
  ],
  [QUAI_NETWORK_LOCAL.chainID]: [
    ...DEFAULT_QUAI_LOCAL.chains.map((chain) => chain.rpc),
  ],
}

export const getShardFromAddress = function (address: string): string {
  if (address === "") {
    console.error("Address is empty or zero")
    return "cyprus-1" // Technically zero address is in every shard, but we return a default instead
  }
  const shardData = QUAI_CONTEXTS.filter((obj) => {
    const num = Number(address.substring(0, 4))
    const start = Number(`0x${obj.byte[0]}`)
    const end = Number(`0x${obj.byte[1]}`)
    return num >= start && num <= end
  })
  if (shardData.length === 0) {
    throw new Error("Invalid address")
  }
  return shardData[0].shard
}

export function setProviderForShard(
  providers: SerialFallbackProvider
): SerialFallbackProvider {
  const shard = globalThis.main.SelectedShard
  if (shard === undefined || shard == "") {
    console.error("Shard is undefined")
    globalThis.main.SetCorrectShard()
    return providers
  }

  for (const provider of providers.providerCreators) {
    if (provider.shard !== undefined && provider.shard == shard) {
      const quaisProvider = provider.creator()
      if (
        quaisProvider instanceof QuaisJsonRpcProvider ||
        quaisProvider instanceof QuaisWebSocketProvider
      ) {
        providers.SetCurrentProvider(
          quaisProvider,
          indexOf(providers.providerCreators, provider)
        )
        return providers
      }
      logger.error("Provider is not a Quais provider")
      console.log(providers.providerCreators)
    } else if (
      provider.rpcUrl !== undefined &&
      ShardFromRpcUrl(provider.rpcUrl) === shard
    ) {
      const quaisProvider = provider.creator()
      if (
        quaisProvider instanceof QuaisJsonRpcProvider ||
        quaisProvider instanceof QuaisWebSocketProvider
      ) {
        providers.SetCurrentProvider(
          quaisProvider,
          indexOf(providers.providerCreators, provider)
        )
        return providers
      }
      logger.error("Provider is not a Quais provider")
      console.log(providers.providerCreators)
    }
  }
  logger.error(`No provider found for shard: ${shard}`)
  console.log(providers.providerCreators)
  return providers
}

export function getProviderForGivenShard(
  providers: SerialFallbackProvider,
  shard: string
): QuaisJsonRpcProvider | QuaisWebSocketProvider {
  if (shard === undefined || shard == "") {
    console.error("No shard given")
    globalThis.main.SetCorrectShard()
    return providers
  }

  for (const provider of providers.providerCreators) {
    if (provider.shard !== undefined && provider.shard == shard) {
      const quaisProvider = provider.creator()
      if (
        quaisProvider instanceof QuaisJsonRpcProvider ||
        quaisProvider instanceof QuaisWebSocketProvider
      ) {
        return quaisProvider
      }
      logger.error("Provider is not a Quais provider")
      console.log(providers.providerCreators)
    } else if (
      provider.rpcUrl !== undefined &&
      ShardFromRpcUrl(provider.rpcUrl) === shard
    ) {
      const quaisProvider = provider.creator()
      if (
        quaisProvider instanceof QuaisJsonRpcProvider ||
        quaisProvider instanceof QuaisWebSocketProvider
      ) {
        return quaisProvider
      }
      logger.error("Provider is not a Quais provider")
      console.log(providers.providerCreators)
    }
  }
  logger.error(`No provider found for shard: ${shard}`)
  console.log(providers.providerCreators)
  return providers
}

export function ShardFromRpcUrl(url: string): string {
  for (const network of DEFAULT_QUAI_NETWORKS) {
    for (const chain of network.chains) {
      if (chain.rpc === url) {
        return chain.shard
      }
      if (
        new URL(chain.rpc).port === new URL(url).port &&
        new URL(chain.rpc).port !== ""
      ) {
        return chain.shard
      }
    }
  }
  logger.error(`Unknown shard for rpc url: ${url}`)
  return ""
}

export function ShardToMulticall(shard: string, network: EVMNetwork): string {
  if (network.chains === undefined) {
    console.log(`Network ${network.name} has no chains`)
    return ""
  }
  for (const chain of network.chains) {
    if (chain.shard === shard) {
      return chain.multicall
    }
  }
  logger.error(`Unknown mutlicall for shard: ${shard}`)
  return ""
}

export function CurrentShardToExplorer(
  network: EVMNetwork,
  address?: string
): string {
  let currentShard = ""
  if (address !== undefined) {
    currentShard = getShardFromAddress(address)
  } else {
    if (
      globalThis.main.SelectedShard === undefined ||
      globalThis.main.SelectedShard === ""
    ) {
      globalThis.main.SetCorrectShard()
    }
    currentShard = globalThis.main.SelectedShard
  }

  if (network.chains === undefined) {
    console.log(`Network ${network.name} has no chains`)
    return ""
  }
  for (const chain of network.chains) {
    if (chain.shard === currentShard) {
      return chain.blockExplorerUrl
    }
  }
  logger.error(`Unknown explorer for shard: ${currentShard}`)
  return ""
}
