import { indexOf } from "lodash"
import logger from "../lib/logger"
import { EVMNetwork } from "../networks"
import SerialFallbackProvider from "../services/chain/serial-fallback-provider"
import { JsonRpcProvider as QuaisJsonRpcProvider, WebSocketProvider as QuaisWebSocketProvider } from "@quais/providers"
import {
  ARBITRUM_NOVA_ETH,
  ARBITRUM_ONE_ETH,
  AVAX,
  BNB,
  ETH,
  GOERLI_ETH,
  MATIC,
  OPTIMISTIC_ETH,
  RBTC,
  ZK_SYNC_ETH,
  QUAI,
  QUAI_LOCAL,
} from "./currencies"


export const ETHEREUM: EVMNetwork = {
  name: "Ethereum",
  baseAsset: ETH,
  chainID: "1",
  family: "EVM",
  coingeckoPlatformID: "ethereum",
}

export const ROOTSTOCK: EVMNetwork = {
  name: "Rootstock",
  baseAsset: RBTC,
  chainID: "30",
  derivationPath: "m/44'/137'/0'/0",
  family: "EVM",
  coingeckoPlatformID: "rootstock",
}

export const POLYGON: EVMNetwork = {
  name: "Polygon",
  baseAsset: MATIC,
  chainID: "137",
  family: "EVM",
  coingeckoPlatformID: "polygon-pos",
}

export const ARBITRUM_ONE: EVMNetwork = {
  name: "Arbitrum",
  baseAsset: ARBITRUM_ONE_ETH,
  chainID: "42161",
  family: "EVM",
  coingeckoPlatformID: "arbitrum-one",
}

export const AVALANCHE: EVMNetwork = {
  name: "Avalanche",
  baseAsset: AVAX,
  chainID: "43114",
  family: "EVM",
  coingeckoPlatformID: "avalanche",
}

export const BINANCE_SMART_CHAIN: EVMNetwork = {
  name: "BNB Chain",
  baseAsset: BNB,
  chainID: "56",
  family: "EVM",
  coingeckoPlatformID: "binance-smart-chain",
}

export const ARBITRUM_NOVA: EVMNetwork = {
  name: "Arbitrum Nova",
  baseAsset: ARBITRUM_NOVA_ETH,
  chainID: "42170",
  family: "EVM",
  coingeckoPlatformID: "arbitrum-nova",
}

export const OPTIMISM: EVMNetwork = {
  name: "Optimism",
  baseAsset: OPTIMISTIC_ETH,
  chainID: "10",
  family: "EVM",
  coingeckoPlatformID: "optimistic-ethereum",
}

export const GOERLI: EVMNetwork = {
  name: "Goerli",
  baseAsset: GOERLI_ETH,
  chainID: "5",
  family: "EVM",
  coingeckoPlatformID: "ethereum",
}

export const ZK_SYNC: EVMNetwork = {
  name: "zkSync Era",
  baseAsset: ZK_SYNC_ETH,
  chainID: "324",
  family: "EVM",
}

export const VALID_SHARDS: Array<string> = ["cyprus-1", "cyprus-2", "cyprus-3", "paxos-1", "paxos-2", "paxos-3", "hydra-1", "hydra-2", "hydra-3"]
export const VALID_SHARDS_NAMES: Array<string> = ["Cyprus 1", "Cyprus 2", "Cyprus 3", "Paxos 1", "Paxos 2", "Paxos 3", "Hydra 1", "Hydra 2", "Hydra 3"]

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
      blockExplorerUrl: "https://cyprus1.colosseum.quaiscan.io"
    },
    {
      name: "Cyprus Two",
      shard: "cyprus-2",
      rpc: "https://rpc.cyprus2.colosseum.quaiscan.io",
      blockExplorerUrl: "https://cyprus2.colosseum.quaiscan.io"
    },
    {
      name: "Cyprus Three",
      shard: "cyprus-3",
      rpc: "https://rpc.cyprus3.colosseum.quaiscan.io",
      blockExplorerUrl: "https://cyprus3.colosseum.quaiscan.io"
    },
    {
      name: "Paxos One",
      shard: "paxos-1",
      rpc: "https://rpc.paxos1.colosseum.quaiscan.io",
      blockExplorerUrl: "https://paxos1.colosseum.quaiscan.io"
    },
    {
      name: "Paxos Two",
      shard: "paxos-2",
      rpc: "https://rpc.paxos2.colosseum.quaiscan.io",
      blockExplorerUrl: "https://paxos2.colosseum.quaiscan.io"
    },
    {
      name: "Paxos Three",
      shard: "paxos-3",
      rpc: "https://rpc.paxos3.colosseum.quaiscan.io",
      blockExplorerUrl: "https://paxos3.colosseum.quaiscan.io"
    },
    {
      name: "Hydra One",
      shard: "hydra-1",
      rpc: "https://rpc.hydra1.colosseum.quaiscan.io",
      blockExplorerUrl: "https://hydra1.colosseum.quaiscan.io"
    },
    {
      name: "Hydra Two",
      shard: "hydra-2",
      rpc: "https://rpc.hydra2.colosseum.quaiscan.io",
      blockExplorerUrl: "https://hydra2.colosseum.quaiscan.io"
    },
    {
      name: "Hydra Three",
      shard: "hydra-3",
      rpc: "https://rpc.hydra3.colosseum.quaiscan.io",
      blockExplorerUrl: "https://hydra3.colosseum.quaiscan.io"
    }
  ]
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
      blockExplorerUrl: "https://cyprus1.garden.quaiscan.io"
    },
    {
      name: "Cyprus Two",
      shard: "cyprus-2",
      rpc: "https://rpc.cyprus2.garden.quaiscan.io",
      blockExplorerUrl: "https://cyprus2.garden.quaiscan.io"
    },
    {
      name: "Cyprus Three",
      shard: "cyprus-3",
      rpc: "https://rpc.cyprus3.garden.quaiscan.io",
      blockExplorerUrl: "https://cyprus3.garden.quaiscan.io"
    },
    {
      name: "Paxos One",
      shard: "paxos-1",
      rpc: "https://rpc.paxos1.garden.quaiscan.io",
      blockExplorerUrl: "https://paxos1.garden.quaiscan.io"
    },
    {
      name: "Paxos Two",
      shard: "paxos-2",
      rpc: "https://rpc.paxos2.garden.quaiscan.io",
      blockExplorerUrl: "https://paxos2.garden.quaiscan.io"
    },
    {
      name: "Paxos Three",
      shard: "paxos-3",
      rpc: "https://rpc.paxos3.garden.quaiscan.io",
      blockExplorerUrl: "https://paxos3.garden.quaiscan.io"
    },
    {
      name: "Hydra One",
      shard: "hydra-1",
      rpc: "https://rpc.hydra1.garden.quaiscan.io",
      blockExplorerUrl: "https://hydra1.garden.quaiscan.io"
    },
    {
      name: "Hydra Two",
      shard: "hydra-2",
      rpc: "https://rpc.hydra2.garden.quaiscan.io",
      blockExplorerUrl: "https://hydra2.garden.quaiscan.io"
    },
    {
      name: "Hydra Three",
      shard: "hydra-3",
      rpc: "https://rpc.hydra3.garden.quaiscan.io",
      blockExplorerUrl: "https://hydra3.garden.quaiscan.io"
    }
  ]
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
      multicall: "0x15b6351eDEcd7142ac4c6fE54948b603D4566862"
    },
    {
      name: "Cyprus Two",
      shard: "cyprus-2",
      rpc: "http://localhost:8542",
      blockExplorerUrl: "https://dev.cyprus2.quaiscan.io",
      multicall: "0x2F3e12280232410e9454254E6152814ce677475B"
    },
    {
      name: "Cyprus Three",
      shard: "cyprus-3",
      rpc: "http://localhost:8674",
      blockExplorerUrl: "https://dev.cyprus3.quaiscan.io",
      multicall: "0x3E4CE31D864BD3CC05E57F6f2a8967e6EF53039b"
    },
    {
      name: "Paxos One",
      shard: "paxos-1",
      rpc: "http://localhost:8512",
      blockExplorerUrl: "https://dev.paxos1.quaiscan.io",
      multicall: "0x729f4724eA02904086b8ce2889959d4aC96127ef"
    },
    {
      name: "Paxos Two",
      shard: "paxos-2",
      rpc: "http://localhost:8544",
      blockExplorerUrl: "https://dev.paxos2.quaiscan.io",
      multicall: "0x84FA6Abf2E7a743719f59E6EF82248cD1C53e621"
    },
    {
      name: "Paxos Three",
      shard: "paxos-3",
      rpc: "http://localhost:8576",
      blockExplorerUrl: "https://dev.paxos3.quaiscan.io",
      multicall: "0x9b05beAA009A7418EC6825452269E7Dfc82777Ce"
    },
    {
      name: "Hydra One",
      shard: "hydra-1",
      rpc: "http://localhost:8614",
      blockExplorerUrl: "https://dev.hydra1.quaiscan.io",
      multicall: "0xc256fc8DA480034E0339A6AC9c38913cC018A505"
    },
    {
      name: "Hydra Two",
      shard: "hydra-2",
      rpc: "http://localhost:8646",
      blockExplorerUrl: "https://dev.hydra2.quaiscan.io",
      multicall: "0xCb9fe98f7c8739B7272d27259747320096610569"
    },
    {
      name: "Hydra Three",
      shard: "hydra-3",
      rpc: "http://localhost:8678",
      blockExplorerUrl: "https://dev.hydra3.quaiscan.io",
      multicall: "0xFB17d5ea1a7e1132E2b12FA7B03cABcb144CDb9d"
    }
  ]
} as Network

export const QUAI_NETWORK: EVMNetwork = {
  name: "Quai Network", // maybe add "Colosseum"
  baseAsset: QUAI,
  chainID: "9000",
  family: "EVM",
  chains: DEFAULT_QUAI_TESTNET.chains,
  derivationPath: "m/44'/994'/0'/0",
  isQuai: true,
}

export const QUAI_NETWORK_LOCAL: EVMNetwork = {
  name: "Quai Network Local",
  baseAsset: QUAI_LOCAL,
  chainID: "1337",
  family: "EVM",
  chains: DEFAULT_QUAI_LOCAL.chains,
  derivationPath: "m/44'/994'/0'/0",
  isQuai: true,
}


export const DEFAULT_NETWORKS = [
  QUAI_NETWORK,
  QUAI_NETWORK_LOCAL,
]

export function isBuiltInNetwork(network: EVMNetwork): boolean {
  return DEFAULT_NETWORKS.some(
    (builtInNetwork) => builtInNetwork.chainID === network.chainID
  )
}

export const DEFAULT_NETWORKS_BY_CHAIN_ID = new Set(
  DEFAULT_NETWORKS.map((network) => network.chainID)
)

export const FORK: EVMNetwork = {
  name: "Ethereum",
  baseAsset: ETH,
  chainID: process.env.MAINNET_FORK_CHAIN_ID ?? "42", // placeholder
  family: "EVM",
  coingeckoPlatformID: "ethereum",
}

export const EIP_1559_COMPLIANT_CHAIN_IDS = new Set(
  [ETHEREUM, POLYGON, GOERLI, AVALANCHE, QUAI_NETWORK, QUAI_NETWORK_LOCAL].map((network) => network.chainID)
)

export const CHAINS_WITH_MEMPOOL = new Set(
  [ETHEREUM, POLYGON, AVALANCHE, GOERLI, BINANCE_SMART_CHAIN, QUAI_NETWORK, QUAI_NETWORK_LOCAL].map(
    (network) => network.chainID
  )
)

export const NETWORK_BY_CHAIN_ID = {
  [QUAI_NETWORK.chainID]: QUAI_NETWORK,
  [QUAI_NETWORK_LOCAL.chainID]: QUAI_NETWORK_LOCAL,
}

export const TEST_NETWORK_BY_CHAIN_ID = new Set(
  [GOERLI].map((network) => network.chainID)
)

export const NETWORK_FOR_LEDGER_SIGNING = []

// Networks that are not added to this struct will
// not have an in-wallet Swap page
export const CHAIN_ID_TO_0X_API_BASE: {
  [chainID: string]: string | undefined
} = {
  [ETHEREUM.chainID]: "api.0x.org",
  [POLYGON.chainID]: "polygon.api.0x.org",
  [OPTIMISM.chainID]: "optimism.api.0x.org",
  [GOERLI.chainID]: "goerli.api.0x.org",
  [ARBITRUM_ONE.chainID]: "arbitrum.api.0x.org",
  [AVALANCHE.chainID]: "avalanche.api.0x.org",
  [BINANCE_SMART_CHAIN.chainID]: "bsc.api.0x.org",
}

export const NETWORKS_SUPPORTING_SWAPS = new Set(
  Object.keys(CHAIN_ID_TO_0X_API_BASE)
)

export const ALCHEMY_SUPPORTED_CHAIN_IDS = new Set(
  [ETHEREUM, POLYGON, ARBITRUM_ONE, OPTIMISM, GOERLI].map(
    (network) => network.chainID
  )
)



// Taken from https://api.coingecko.com/api/v3/asset_platforms
export const CHAIN_ID_TO_COINGECKO_PLATFORM_ID: {
  [chainId: string]: string
} = {
  "250": "fantom",
  "122": "fuse",
  "361": "theta",
  "199": "bittorent",
  "106": "velas",
  "128": "huobi-token",
  "96": "bitkub-chain",
  "333999": "polis-chain",
  "321": "kucoin-community-chain",
  "1285": "moonriver",
  "25": "cronos",
  "10000": "smartbch",
  "1313161554": "aurora",
  "88": "tomochain",
  "1088": "metis-andromeda",
  "2001": "milkomeda-cardano",
  "9001": "evmos",
  "288": "boba",
  "42220": "celo",
  "1284": "moonbeam",
  "66": "okex-chain",
}

/**
 * Method list, to describe which rpc method calls on which networks should
 * prefer alchemy provider over the generic ones.
 *
 * The method names can be full or the starting parts of the method name.
 * This allows us to use "namespaces" for providers eg `alchemy_...` or `qn_...`
 *
 * The structure is network specific with an extra `everyChain` option.
 * The methods in this array will be directed towards alchemy on every network.
 */
export const RPC_METHOD_PROVIDER_ROUTING = {
  everyChain: [
    "alchemy_", // alchemy specific api calls start with this
    "eth_sendRawTransaction", // broadcast should always go to alchemy
    "eth_subscribe", // generic http providers do not support this, but dapps need this
    "eth_estimateGas", // just want to be safe, when setting up a transaction
  ],
  [OPTIMISM.chainID]: [
    "eth_call", // this is causing issues on optimism with ankr and is used heavily by uniswap
  ],
  [ARBITRUM_ONE.chainID]: [
    "eth_call", // this is causing issues on arbitrum with ankr and is used heavily by uniswap
  ],
} as const

export const CHAIN_ID_TO_OPENSEA_CHAIN = {
  [ETHEREUM.chainID]: "ethereum",
  [OPTIMISM.chainID]: "optimism",
  [POLYGON.chainID]: "matic",
  [ARBITRUM_ONE.chainID]: "arbitrum",
  [AVALANCHE.chainID]: "avalanche",
  [BINANCE_SMART_CHAIN.chainID]: "bsc",
}

export const NETWORKS_WITH_FEE_SETTINGS = new Set(
  [ETHEREUM, POLYGON, ARBITRUM_ONE, AVALANCHE].map((network) => network.chainID)
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

export const NETWORK_LIST = []

export const NUM_ZONES_IN_REGION = 3
export const NUM_REGIONS_IN_PRIME = 3

export const NETWORK_TO_CHAIN_CODE = {
  Colosseum: 994,
  Garden: 994,
  Local: 994
}

export const CHAIN_ID_TO_NETWORK = {
  9000: "Colosseum",
  12000: "Garden",
  1337: "Local"
}

export const NETWORK_TO_CHAIN_ID = {
  Colosseum: 9000,
  Garden: 12000,
  Local: 1337
}

export const DEFAULT_QUAI_NETWORKS = [
  DEFAULT_QUAI_TESTNET,
  DEFAULT_QUAI_DEVNET,
  DEFAULT_QUAI_LOCAL
]

export const QUAI_CONTEXTS = [
  {
    name: "Cyprus One",
    shard: "cyprus-1",
    context: 2,
    byte: ["00", "1D"]
  },
  {
    name: "Cyprus Two",
    shard: "cyprus-2",
    context: 2,
    byte: ["1E", "3A"]
  },
  {
    name: "Cyprus Three",
    shard: "cyprus-3",
    context: 2,
    byte: ["3B", "57"]
  },
  {
    name: "Paxos One",
    shard: "paxos-1",
    context: 2,
    byte: ["58", "73"]
  },
  {
    name: "Paxos Two",
    shard: "paxos-2",
    context: 2,
    byte: ["74", "8F"]
  },
  {
    name: "Paxos Three",
    shard: "paxos-3",
    context: 2,
    byte: ["90", "AB"]
  },
  {
    name: "Hydra One",
    shard: "hydra-1",
    context: 2,
    byte: ["AC", "C7"]
  },
  {
    name: "Hydra Two",
    shard: "hydra-2",
    context: 2,
    byte: ["C8", "E3"]
  },
  {
    name: "Hydra Three",
    shard: "hydra-3",
    context: 2,
    byte: ["E4", "FF"]
  }
]

export const CHAIN_ID_TO_RPC_URLS: {
  [chainId: string]: Array<string> | undefined
} = {
  [ROOTSTOCK.chainID]: ["https://public-node.rsk.co"],
  [POLYGON.chainID]: [
    // This one sometimes returns 0 for eth_getBalance
    "https://polygon-rpc.com",
    "https://1rpc.io/matic",
  ],
  [OPTIMISM.chainID]: [
    "https://rpc.ankr.com/optimism",
    "https://1rpc.io/op",
    "https://optimism-mainnet.public.blastapi.io",
  ],
  [ETHEREUM.chainID]: ["https://rpc.ankr.com/eth", "https://1rpc.io/eth"],
  [ARBITRUM_ONE.chainID]: [
    "https://rpc.ankr.com/arbitrum",
    "https://1rpc.io/arb",
  ],
  [ARBITRUM_NOVA.chainID]: ["https://nova.arbitrum.io/rpc	"],
  [GOERLI.chainID]: ["https://ethereum-goerli-rpc.allthatnode.com"],
  [AVALANCHE.chainID]: [
    "https://api.avax.network/ext/bc/C/rpc",
    "https://1rpc.io/avax/c",
    "https://rpc.ankr.com/avalanche",
  ],
  [BINANCE_SMART_CHAIN.chainID]: [
    "https://rpc.ankr.com/bsc",
    "https://bsc-dataseed.binance.org",
  ],
  // All default quai local chain rpcs
  [QUAI_NETWORK.chainID]: [...DEFAULT_QUAI_TESTNET.chains.map((chain) => chain.rpc)],
  [QUAI_NETWORK_LOCAL.chainID]: [...DEFAULT_QUAI_LOCAL.chains.map((chain) => chain.rpc)],
}

export function getExplorerURLForShard(network: Network, shard: string) {
  let chainData = network.chains.find(
    (chain) => chain.shard === shard
  ) as ChainData
  if (chainData === undefined) {
    return undefined
  }
  return chainData.blockExplorerUrl
}

export const getShardFromAddress = function(address: string): string {
  if (address === "") {
    console.error("Address is empty or zero")
    return "cyprus-1" // Technically zero address is in every shard, but we return a default instead
  }
  let shardData = QUAI_CONTEXTS.filter((obj) => {
    const num = Number(address.substring(0, 4))
    const start = Number("0x" + obj.byte[0])
    const end = Number("0x" + obj.byte[1])
    return num >= start && num <= end
  })
  if (shardData.length === 0) {
    throw new Error("Invalid address")
}
return shardData[0].shard
}

export function setProviderForShard(providers: SerialFallbackProvider): SerialFallbackProvider {
  let shard = globalThis.main.SelectedShard
  if (shard === undefined || shard == "") {
    console.error("Shard is undefined")
    globalThis.main.SetCorrectShard()
    return providers
  }
  
  for (let provider of providers.providerCreators) {
    if (provider.shard !== undefined && provider.shard == shard) {
      let quaisProvider = provider.creator()
      if (quaisProvider instanceof QuaisJsonRpcProvider || quaisProvider instanceof QuaisWebSocketProvider) {
        providers.SetCurrentProvider(quaisProvider, indexOf(providers.providerCreators, provider))
        return providers
      } else {
        logger.error("Provider is not a Quais provider")
        console.log(providers.providerCreators)
      }
    } else if (provider.rpcUrl !== undefined && ShardFromRpcUrl(provider.rpcUrl) === shard) {
      let quaisProvider = provider.creator()
      if (quaisProvider instanceof QuaisJsonRpcProvider || quaisProvider instanceof QuaisWebSocketProvider) {
        providers.SetCurrentProvider(quaisProvider, indexOf(providers.providerCreators, provider))
        return providers
      } else {
        logger.error("Provider is not a Quais provider")
        console.log(providers.providerCreators)
      }  
    }
  }
  logger.error("No provider found for shard: " + shard)
  console.log(providers.providerCreators)
  return providers
}

export function getProviderForGivenShard(providers: SerialFallbackProvider, shard: string): QuaisJsonRpcProvider | QuaisWebSocketProvider {
  if (shard === undefined || shard == "") {
    console.error("No shard given")
    globalThis.main.SetCorrectShard()
    return providers
  }
  
  for (let provider of providers.providerCreators) {
    if (provider.shard !== undefined && provider.shard == shard) {
      let quaisProvider = provider.creator()
      if (quaisProvider instanceof QuaisJsonRpcProvider || quaisProvider instanceof QuaisWebSocketProvider) {
        return quaisProvider
      } else {
        logger.error("Provider is not a Quais provider")
        console.log(providers.providerCreators)
      }
    } else if (provider.rpcUrl !== undefined && ShardFromRpcUrl(provider.rpcUrl) === shard) {
      let quaisProvider = provider.creator()
      if (quaisProvider instanceof QuaisJsonRpcProvider || quaisProvider instanceof QuaisWebSocketProvider) {
        return quaisProvider
      } else {
        logger.error("Provider is not a Quais provider")
        console.log(providers.providerCreators)
      }
    }
  }
  logger.error("No provider found for shard: " + shard)
  console.log(providers.providerCreators)
  return providers
}

export function ShardFromRpcUrl(url: string): string {
  for (let network of DEFAULT_QUAI_NETWORKS) {
    for (let chain of network.chains) {
      if (chain.rpc === url) {
        return chain.shard
      } else if (new URL(chain.rpc).port === new URL(url).port && new URL(chain.rpc).port !== '') {
        return chain.shard
      }
    }
  }
  logger.error("Unknown shard for rpc url: " + url)
  return ""
}

export function ShardToMulticall(shard: string, network: EVMNetwork): string {
  if (network.chains === undefined) {
    console.log("Network " + network.name + " has no chains")
    return ""
  }
  for (let chain of network.chains) {
    if (chain.shard === shard) {
      return chain.multicall
    }
  }
  logger.error("Unknown mutlicall for shard: " + shard)
  return ""
}

export function CurrentShardToExplorer(network: EVMNetwork, address?: string): string {
  let currentShard = "";
  if (address !== undefined) {
    currentShard = getShardFromAddress(address)
  } else {
    if (globalThis.main.SelectedShard === undefined || globalThis.main.SelectedShard === "") {
      globalThis.main.SetCorrectShard()
    }
    currentShard = globalThis.main.SelectedShard
  }
  
  if (network.chains === undefined) {
    console.log("Network " + network.name + " has no chains")
    return ""
  }
  for (let chain of network.chains) {
    if (chain.shard === currentShard) {
      return chain.blockExplorerUrl
    }
  }
  logger.error("Unknown explorer for shard: " + currentShard)
  return ""
}
