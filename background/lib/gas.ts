import { Provider } from "@ethersproject/abstract-provider"
import { fetchJson } from "@ethersproject/web"
import logger from "./logger"
import { BlockPrices, EVMNetwork } from "../networks"
import {
  ARBITRUM_ONE,
  BINANCE_SMART_CHAIN,
  EIP_1559_COMPLIANT_CHAIN_IDS,
  ETHEREUM,
  POLYGON,
  QUAI_NETWORK,
} from "../constants/networks"
import { gweiToWei } from "./utils"

type PolygonFeeDetails = {
  maxPriorityFee: number // gwei
  maxFee: number // gwei
}

type PolygonGasResponse = {
  safeLow: PolygonFeeDetails
  standard: PolygonFeeDetails
  fast: PolygonFeeDetails
  estimatedBaseFee: number // gwei
  blockTime: number
  blockNumber: number
}

// Not perfect but works most of the time.  Our fallback method does not work at all for polygon.
// This is because the baseFeePerGas on polygon can be so small (oftentimes sub 100 wei (not gwei)) that
// estimating maxFeePerGas as a function of baseFeePerGas almost always results in a "transaction underpriced"
// being returned from alchemy because our maxFeePerGas is below its acceptance threshhold.
const getPolygonGasPrices = async (price: bigint): Promise<BlockPrices> => {
  // @TODO Validate this response using ajv
  const gasEstimates = (await fetchJson(
    "https://gasstation.polygon.technology/v2"
  )) as PolygonGasResponse

  const baseFeePerGas = BigInt(Math.ceil(gasEstimates.estimatedBaseFee * 1e9))

  return {
    network: POLYGON,
    blockNumber: gasEstimates.blockNumber,
    baseFeePerGas,
    estimatedPrices: [
      {
        confidence: 99,
        maxPriorityFeePerGas: gweiToWei(
          Math.ceil(gasEstimates.fast.maxPriorityFee)
        ),
        maxFeePerGas: gweiToWei(Math.ceil(gasEstimates.fast.maxFee)),
        price, // this estimate isn't great
      },
      {
        confidence: 95,
        maxPriorityFeePerGas: gweiToWei(
          Math.ceil(gasEstimates.standard.maxPriorityFee)
        ),
        maxFeePerGas: gweiToWei(Math.ceil(gasEstimates.standard.maxFee)),
        price,
      },
      {
        confidence: 70,
        maxPriorityFeePerGas: gweiToWei(
          Math.ceil(gasEstimates.safeLow.maxPriorityFee)
        ),
        maxFeePerGas: gweiToWei(Math.ceil(gasEstimates.safeLow.maxFee)),
        price,
      },
    ],
    dataSource: "local",
  }
}

const getArbitrumPrices = async (
  baseFeePerGas: bigint,
  blockNumber: number
): Promise<BlockPrices> => {
  return {
    network: ARBITRUM_ONE,
    blockNumber,
    baseFeePerGas,
    estimatedPrices: [
      {
        confidence: 99,
        maxPriorityFeePerGas: 0n, // priority fee doesn't make sense for Arbitrum
        maxFeePerGas: 0n, // max fee doesn't make sense for Arbitrum
        price: baseFeePerGas * 3n,
      },
      {
        confidence: 95,
        maxPriorityFeePerGas: 0n,
        maxFeePerGas: 0n,
        price: baseFeePerGas * 2n,
      },
      {
        confidence: 70,
        maxPriorityFeePerGas: 0n,
        maxFeePerGas: 0n,
        price: baseFeePerGas,
      },
    ],
    dataSource: "local",
  }
}

const getLegacyGasPrices = async (
  network: EVMNetwork,
  gasPrice: bigint,
  blockNumber: number
): Promise<BlockPrices> => {
  return {
    network,
    blockNumber,
    baseFeePerGas: gasPrice,
    estimatedPrices: [
      {
        confidence: 99,
        maxPriorityFeePerGas: 0n, // doesn't exist
        maxFeePerGas: 0n, // doesn't exist
        price: gasPrice,
      },
      {
        confidence: 95,
        maxPriorityFeePerGas: 0n,
        maxFeePerGas: 0n,
        price: gasPrice,
      },
      {
        confidence: 70,
        maxPriorityFeePerGas: 0n,
        maxFeePerGas: 0n,
        price: gasPrice,
      },
    ],
    dataSource: "local",
  }
}

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

  if (network.chainID === POLYGON.chainID) {
    try {
      return await getPolygonGasPrices(
        feeData?.gasPrice?.toBigInt() ??
          0n /* @TODO what do we do if this is 0n */
      )
    } catch (e) {
      logger.error("Error getting block prices from Polygon", e)
    }
  }

  if (network.chainID === ARBITRUM_ONE.chainID) {
    return getArbitrumPrices(baseFeePerGas ?? 0n, currentBlock.number)
  }

  if (network.chainID === BINANCE_SMART_CHAIN.chainID) {
    try {
      const gasPrice = (await provider.getGasPrice()).toBigInt()

      return await getLegacyGasPrices(
        BINANCE_SMART_CHAIN,
        gasPrice,
        currentBlock.number
      )
    } catch (err) {
      logger.error("Error getting gas price", err)
    }
  }

  // otherwise, we're going it alone!

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
