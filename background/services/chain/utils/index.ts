import { getZoneForAddress, Zone, Block, BigNumberish, toBigInt } from "quais"
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
  const { number, hash, parentHash, baseFeePerGas } = block.woBody.header

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

export const getExtendedZoneForAddress = (
  address: string,
  inHumanForm = true,
  capitalizeFirstLetter = false
): string => {
  const zone = getZoneForAddress(address)

  if (!zone) return ""
  if (!inHumanForm) return zone

  for (let i = 0; i < Object.entries(Zone).length; i + 1) {
    const [key, enumValue] = Object.entries(Zone)[i]
    if (enumValue === zone) {
      const match = key.match(/([a-zA-Z]+)(\d+)/)

      if (match) {
        const [, letters, number] = match

        return capitalizeFirstLetter
          ? `${letters}-${number}`
          : `${letters.toLowerCase()}-${number}`
      }
    }
  }

  return ""
}

export const getNetworkById = (chainId: BigNumberish | null | undefined) => {
  if (!chainId) throw new Error("Can't find network")
  return globalThis.main.chainService.supportedNetworks.find(
    (net) => toBigInt(net.chainID) === toBigInt(chainId)
  )
}
