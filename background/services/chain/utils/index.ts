import { getZoneForAddress, toBigInt, Zone, Block } from "quais"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
import { AnyEVMBlock, KnownTxTypes } from "../../../networks"
import { NetworkInterfaceGA } from "../../../constants/networks/networkTypes"
/**
 * Parse a block as returned by a polling provider.
 */
export function blockFromEthersBlock(
  network: NetworkInterfaceGA,
  block: Block
): AnyEVMBlock {
  if (!block) throw new Error("Failed get Block")

  // TODO-MIGRATION: CHECK BLOCK (blockHeight and parentHash)
  return {
    hash: block.woBody.header.hash,
    blockHeight: Number(block.woBody.header.number[2]),
    parentHash: block.woBody.header.parentHash[2],
    difficulty: 0n,
    timestamp: block.date?.getTime(),
    baseFeePerGas: block.woBody.header.baseFeePerGas,
    network,
  } as AnyEVMBlock
}

/**
 * Parse a block as returned by a provider query.
 */
export function blockFromProviderBlock(
  network: NetworkInterfaceGA,
  incomingGethResult: unknown
): AnyEVMBlock {
  const gethResult = incomingGethResult as {
    hash: string
    number: string
    parentHash: string
    difficulty: string
    timestamp: string
    baseFeePerGas?: string
  }

  const blockNumber: string = Array.isArray(gethResult.number)
    ? gethResult.number[gethResult.number.length - 1]
    : gethResult.number

  return {
    hash: gethResult.hash,
    blockHeight: Number(toBigInt(blockNumber)),
    parentHash: gethResult.parentHash,
    // PoS networks will not have block difficulty.
    difficulty: gethResult.difficulty ? BigInt(gethResult.difficulty) : 0n,
    timestamp: Number(toBigInt(gethResult.timestamp)),
    baseFeePerGas: gethResult.baseFeePerGas
      ? BigInt(gethResult.baseFeePerGas)
      : undefined,
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
