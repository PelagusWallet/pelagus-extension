import { CurrentShardToExplorer } from "@pelagus/pelagus-background/constants"
import { PELAGUS_NETWORKS } from "@pelagus/pelagus-background/constants/networks/networks"
import { NetworkInterface } from "@pelagus/pelagus-background/constants/networks/networkTypes"
import { isQuaiHandle } from "@pelagus/pelagus-background/constants/networks/networkUtils"
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

export function getNetworkIconFallbackColor(network: NetworkInterface): string {
  return NETWORK_COLORS_FALLBACK[
    Number.parseInt(network.chainID, 10) % NETWORK_COLORS_FALLBACK.length
  ]
}

export function getNetworkIconName(network: NetworkInterface): string {
  return network.baseAsset.name.replaceAll(" ", "").toLowerCase()
}

export const getNetworkIcon = (network: NetworkInterface): string => {
  const iconName = getNetworkIconName(network)

  return `./images/networks/${iconName}@2x.png`
}

export const getBlockExplorerURL = (
  network: NetworkInterface,
  address: string
): string | undefined => {
  return PELAGUS_NETWORKS.find((net) => net.chainID === network.chainID)
    ? isQuaiHandle(network)
      ? CurrentShardToExplorer(network, address)
      : blockExplorer[network.chainID].url
    : network.blockExplorerURL
}
