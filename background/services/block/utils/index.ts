import { Block } from "quais"
import { NetworkInterface } from "../../../constants/networks/networkTypes"
import { AnyEVMBlock } from "../../../networks"

export function blockFromProviderBlock(
  network: NetworkInterface,
  block: Block
): AnyEVMBlock {
  const hash = block.hash
  const { difficulty, timestamp } = block.woHeader
  const { number, parentHash, baseFeePerGas } = block.header

  const blockNumber: number | null = Array.isArray(number)
    ? number[number.length - 1]
    : number

  return {
    hash: hash || "",
    blockHeight: blockNumber,
    parentHash: parentHash[parentHash.length - 1] || "",
    difficulty: BigInt(difficulty),
    timestamp: Number(timestamp),
    baseFeePerGas: baseFeePerGas ? BigInt(baseFeePerGas) : 0n,
    network,
  }
}
