import { Block } from "quais"
import { NetworkInterface } from "../../../constants/networks/networkTypes"
import { AnyEVMBlock } from "../../../networks"
import { parseHexTimestamp } from "../../../utils/time"

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
