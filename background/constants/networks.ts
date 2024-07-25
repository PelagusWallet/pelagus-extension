/* eslint-disable no-restricted-syntax */
/* eslint-disable import/no-cycle */
// eslint-disable-next-line max-classes-per-file
import { Zone } from "quais"
import logger from "../lib/logger"
import { QUAI, QUAI_LOCAL } from "."
import { EVMNetwork } from "../networks"
import { getExtendedZoneForAddress } from "../services/chain/utils"
import { NetworkInterface } from "./networks/networkTypes"

export const VALID_ZONES: Array<Zone> = [
  Zone.Cyprus1,
  // TODO-MIGRATION temporary
  Zone.Cyprus2,
  Zone.Cyprus3,
  Zone.Paxos1,
  Zone.Paxos2,
  Zone.Paxos3,
  Zone.Hydra1,
  Zone.Hydra2,
  Zone.Hydra3,
]

export const VALID_ZONES_NAMES: Array<string> = [
  "Cyprus 1",
  // TODO-MIGRATION temporary
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

export const DEFAULT_TEST_NETWORKS = [QUAI_NETWORK_LOCAL]

export const EIP_1559_COMPLIANT_CHAIN_IDS = new Set(
  [QUAI_NETWORK, QUAI_NETWORK_LOCAL].map((network) => network.chainID)
)

export const NETWORK_BY_CHAIN_ID = {
  [QUAI_NETWORK.chainID]: QUAI_NETWORK,
  [QUAI_NETWORK_LOCAL.chainID]: QUAI_NETWORK_LOCAL,
}
export const TEST_NETWORK_BY_CHAIN_ID = new Set(
  DEFAULT_TEST_NETWORKS.map((network) => network.chainID)
)

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

export function ShardToMulticall(
  shard: string,
  network: NetworkInterface
): string {
  if (network.chains === undefined) return ""

  for (const chain of network.chains) {
    if (chain.shard === shard) return chain.multicall
  }
  logger.error(`Unknown mutlicall for shard: ${shard}`)
  return ""
}

export function CurrentShardToExplorer(
  network: NetworkInterface,
  address?: string
): string {
  let currentShard = ""
  if (address !== undefined) {
    currentShard = getExtendedZoneForAddress(address)
  } else {
    if (
      globalThis.main.SelectedShard === undefined ||
      globalThis.main.SelectedShard === ""
    ) {
      globalThis.main.SetCorrectShard()
    }
    currentShard = globalThis.main.SelectedShard
  }

  if (network.chains === undefined) return ""

  for (const chain of network.chains) {
    if (chain.shard === currentShard) return chain.blockExplorerUrl
  }
  logger.error(`Unknown explorer for shard: ${currentShard}`)
  return ""
}
