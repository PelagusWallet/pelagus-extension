import { JsonRpcProvider, Shard } from "quais"
import logger from "./logger"
import { BlockPrices } from "../networks"
import { EIP_1559_COMPLIANT_CHAIN_IDS } from "../constants"
import { NetworkInterfaceGA } from "../constants/networks/networkTypes"

export default async function getBlockPrices(
  network: NetworkInterfaceGA,
  provider: JsonRpcProvider,
  shard: Shard
): Promise<BlockPrices> {
  const [currentBlock, feeData] = await Promise.all([
    provider.getBlock(shard, "latest"),
    provider.getFeeData(),
  ])
  const baseFeePerGas = currentBlock?.woBody.header.baseFeePerGas

  if (feeData.gasPrice === null) {
    logger.warn("Not receiving accurate gas prices from provider", feeData)
  }

  const gasPrice = feeData?.gasPrice || 0n

  if (baseFeePerGas) {
    return {
      network,
      blockNumber: Number(currentBlock.woBody.header.number[2]),
      baseFeePerGas,
      estimatedPrices: [
        {
          confidence: 99,
          maxPriorityFeePerGas: 2_500_000_000n,
          maxFeePerGas: baseFeePerGas * 2n + 2_500_000_000n,
          price: gasPrice, // this estimate isn't great
        },
        {
          confidence: 95,
          maxPriorityFeePerGas: 1_500_000_000n,
          maxFeePerGas: (baseFeePerGas * 15n) / 10n + 1_500_000_000n,
          price: (gasPrice * 9n) / 10n,
        },
        {
          confidence: 70,
          maxPriorityFeePerGas: 1_100_000_000n,
          maxFeePerGas: (baseFeePerGas * 13n) / 10n + 1_100_000_000n,
          price: (gasPrice * 8n) / 10n,
        },
      ],
      dataSource: "local",
    }
  }

  if (
    EIP_1559_COMPLIANT_CHAIN_IDS.has(network.chainID) &&
    (feeData.maxPriorityFeePerGas === null || feeData.maxFeePerGas === null)
  ) {
    logger.warn(
      "Not receiving accurate EIP-1559 gas prices from provider",
      feeData,
      network.baseAsset.name
    )
  }

  const maxFeePerGas = feeData?.maxFeePerGas || 0n
  const maxPriorityFeePerGas = feeData?.maxPriorityFeePerGas || 0n

  return {
    network,
    blockNumber: Number(currentBlock?.woBody.header.number[2]),
    baseFeePerGas: (maxFeePerGas - maxPriorityFeePerGas) / 2n,
    estimatedPrices: [
      {
        confidence: 99,
        maxPriorityFeePerGas,
        maxFeePerGas,
        price: gasPrice,
      },
    ],
    dataSource: "local",
  }
}
