import {
  CurrentShardToExplorer,
  DEFAULT_NETWORKS_BY_CHAIN_ID,
  isBuiltInNetwork,
} from "@pelagus/pelagus-background/constants"
import { EVMNetwork } from "@pelagus/pelagus-background/networks"
import { blockExplorer } from "./constants"

export const NETWORK_COLORS_FALLBACK = [
  "#CC3C3C",
  "#B64396",
  "#D1517F",
  "#5184D1",
  "#404BB2",
  "#43B69A",
  "#43B671",
  "#9FB643",
  "#CDA928",
  "#EAC130",
  "#EA7E30",
]

export function getNetworkIconFallbackColor(network: EVMNetwork): string {
  return NETWORK_COLORS_FALLBACK[
    Number.parseInt(network.chainID, 10) % NETWORK_COLORS_FALLBACK.length
  ]
}

export function getNetworkIconName(network: EVMNetwork): string {
  return network.name.replaceAll(" ", "").toLowerCase()
}

export const getNetworkIconSquared = (network: EVMNetwork): string => {
  if (isBuiltInNetwork(network)) {
    const iconName = getNetworkIconName(network)

    return `./images/networks/${iconName}-square@2x.png`
  }

  return ""
}

export const getNetworkIcon = (network: EVMNetwork): string => {
  if (isBuiltInNetwork(network)) {
    const iconName = getNetworkIconName(network)

    return `./images/networks/${iconName}@2x.png`
  }

  return ""
}

export const getBlockExplorerURL = (
  network: EVMNetwork,
  address: string
): string | undefined => {
  return DEFAULT_NETWORKS_BY_CHAIN_ID.has(network.chainID)
    ? network.isQuai
      ? CurrentShardToExplorer(network, address)
      : blockExplorer[network.chainID].url
    : network.blockExplorerURL
}
