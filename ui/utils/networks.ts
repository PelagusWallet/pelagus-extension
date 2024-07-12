import { CurrentShardToExplorer } from "@pelagus/pelagus-background/constants"
import { blockExplorer } from "./constants"
import { NetworksArray } from "@pelagus/pelagus-background/constants/networks/networks"
import { NetworkInterfaceGA } from "@pelagus/pelagus-background/constants/networks/networkTypes"
import { isQuaiHandle } from "@pelagus/pelagus-background/constants/networks/networkUtils"

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

export function getNetworkIconFallbackColor(
  network: NetworkInterfaceGA
): string {
  return NETWORK_COLORS_FALLBACK[
    Number.parseInt(network.chainID, 10) % NETWORK_COLORS_FALLBACK.length
  ]
}

export function getNetworkIconName(network: NetworkInterfaceGA): string {
  return network.baseAsset.name.replaceAll(" ", "").toLowerCase()
}

export const getNetworkIconSquared = (network: NetworkInterfaceGA): string => {
  const iconName = getNetworkIconName(network)

  return `./images/networks/${iconName}-square@2x.png`
}

export const getNetworkIcon = (network: NetworkInterfaceGA): string => {
  const iconName = getNetworkIconName(network)

  return `./images/networks/${iconName}@2x.png`
}

export const getBlockExplorerURL = (
  network: NetworkInterfaceGA,
  address: string
): string | undefined => {
  return NetworksArray.find((net) => net.chainID === network.chainID)
    ? isQuaiHandle(network)
      ? CurrentShardToExplorer(network, address)
      : blockExplorer[network.chainID].url
    : network.blockExplorerURL
}
