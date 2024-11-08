import { getZoneForAddress, BigNumberish, toBigInt } from "quais"

// TODO: should be provided from SDK
const shardsForUI = {
  "0x00": "cyprus-1",
  "0x01": "cyprus-2",
  "0x02": "cyprus-3",
  "0x10": "paxos-1",
  "0x11": "paxos-2",
  "0x12": "paxos-3",
  "0x20": "hydra-1",
  "0x21": "hydra-2",
  "0x22": "hydra-3",
}

export const getExtendedZoneForAddress = (
  address: string,
  inHumanForm = true,
  capitalizeFirstLetter = false
): string => {
  const zone = getZoneForAddress(address)

  if (!zone) return ""
  if (!inHumanForm) return zone

  return !capitalizeFirstLetter
    ? shardsForUI[zone]
    : shardsForUI[zone].charAt(0).toUpperCase() + shardsForUI[zone].slice(1)
}

export const getNetworkById = (chainId: BigNumberish | null | undefined) => {
  if (!chainId) throw new Error("Can't find network")
  return globalThis.main.chainService.supportedNetworks.find(
    (net) => toBigInt(net.chainID) === toBigInt(chainId)
  )
}
