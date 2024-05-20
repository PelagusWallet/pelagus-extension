import { Provider } from "@ethersproject/abstract-provider"
import logger from "./logger"
import { BlockPrices, EVMNetwork } from "../networks"
import { EIP_1559_COMPLIANT_CHAIN_IDS } from "../constants"

export default async function getBlockPrices(
  network: EVMNetwork,
  provider: Provider
): Promise<BlockPrices> {
  const [currentBlock, feeData] = await Promise.all([
    provider.getBlock("latest"),
    provider.getFeeData(),
  ])
  console.log("currentBlock", currentBlock)
  console.log("feeData", feeData)

  const baseFeePerGas = currentBlock?.baseFeePerGas?.toBigInt()

  if (feeData.gasPrice === null) {
    logger.warn("Not receiving accurate gas prices from provider", feeData)
  }

  const gasPrice = feeData?.gasPrice?.toBigInt() || 0n

  if (baseFeePerGas) {
    return {
      network,
      blockNumber: currentBlock.number,
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
      network.name
    )
  }

  const maxFeePerGas = feeData?.maxFeePerGas?.toBigInt() || 0n
  const maxPriorityFeePerGas = feeData?.maxPriorityFeePerGas?.toBigInt() || 0n

  return {
    network,
    blockNumber: currentBlock.number,
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
