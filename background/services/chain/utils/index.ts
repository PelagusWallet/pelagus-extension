import { getZoneForAddress, Block, BigNumberish, toBigInt } from "quais"
import { AnyEVMBlock } from "../../../networks"
import { NetworkInterface } from "../../../constants/networks/networkTypes"
import { parseHexTimestamp } from "../../../utils/time"

/**
 * Parse a block as returned by a provider query.
 */
export function blockFromProviderBlock(
  network: NetworkInterface,
  block: Block
): AnyEVMBlock {
  const { difficulty, time } = block.woHeader
  const { number, hash, parentHash, baseFeePerGas } = block.header

  const blockNumber: string = Array.isArray(number)
    ? number[number.length - 1]
    : number

  return {
    hash: hash || "",
    blockHeight: Number(blockNumber),
    parentHash: parentHash[parentHash.length - 1] || "",
    difficulty: BigInt(difficulty),
    timestamp: parseHexTimestamp(time),
    baseFeePerGas: baseFeePerGas ? BigInt(baseFeePerGas) : 0n,
    network,
  }
}

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
