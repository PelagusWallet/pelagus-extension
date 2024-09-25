import { JsonRpcProvider, Shard, toZone } from "quais"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import logger from "../../lib/logger"
import { AnyEVMBlock, BlockPrices, toHexChainID } from "../../networks"
import { EIP_1559_COMPLIANT_CHAIN_IDS, MINUTE } from "../../constants"
import PreferenceService from "../preferences"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import BaseService from "../base"
import { blockFromProviderBlock } from "./utils"
import ChainService from "../chain"
import { BlockDatabase, initializeBlockDatabase } from "./db"
import { getExtendedZoneForAddress } from "../chain/utils"

const GAS_POLLS_PER_PERIOD = 1 // 1 time per 5 minutes
const GAS_POLLING_PERIOD = 5 // 5 minutes

interface Events extends ServiceLifecycleEvents {
  block: AnyEVMBlock
  blockPrices: { blockPrices: BlockPrices; network: NetworkInterface }
}

export default class BlockService extends BaseService<Events> {
  static create: ServiceCreatorFunction<
    Events,
    BlockService,
    [Promise<ChainService>, Promise<PreferenceService>]
  > = async (chainService, preferenceService) => {
    return new this(
      initializeBlockDatabase(),
      await chainService,
      await preferenceService
    )
  }

  private constructor(
    private db: BlockDatabase,
    private chainService: ChainService,
    private preferenceService: PreferenceService
  ) {
    super({
      blockPrices: {
        runAtStart: false,
        schedule: {
          periodInMinutes: GAS_POLLING_PERIOD,
        },
        handler: () => {
          this.pollBlockPrices()
        },
      },
    })
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()

    this.chainService.supportedNetworks.forEach((network) =>
      Promise.allSettled([
        this.pollLatestBlock(network),
        this.pollBlockPrices(),
      ]).catch((e) => logger.error(e))
    )
  }

  async getBlockHeight(network: NetworkInterface): Promise<number> {
    try {
      const cachedBlock = await this.db.getLatestBlock(network)
      if (cachedBlock) return cachedBlock.blockHeight

      const { address } = await this.preferenceService.getSelectedAccount()
      const shard = getExtendedZoneForAddress(address, false) as Shard

      return await this.chainService.jsonRpcProvider.getBlockNumber(shard)
    } catch (e) {
      logger.error(e)
      throw new Error("Failed get block number")
    }
  }

  async pollLatestBlock(network: NetworkInterface): Promise<void> {
    try {
      const { address } = await this.preferenceService.getSelectedAccount()

      const shard = getExtendedZoneForAddress(address, false) as Shard

      const latestBlock = await this.chainService.jsonRpcProvider.getBlock(
        shard,
        "latest"
      )
      if (!latestBlock) return

      const block = blockFromProviderBlock(network, latestBlock)
      await this.db.addBlock(block)

      await this.emitter.emit("block", block)
    } catch (e) {
      logger.error("Error getting block number", e)
    }
  }

  async getBlockByHash(
    network: NetworkInterface,
    shard: Shard,
    blockHash: string
  ): Promise<AnyEVMBlock> {
    try {
      const cachedBlock = await this.db.getBlock(network, blockHash)

      if (cachedBlock) return cachedBlock

      const resultBlock = await this.chainService.jsonRpcProvider.getBlock(
        shard,
        blockHash
      )
      if (!resultBlock) {
        throw new Error(`Failed to get block`)
      }

      const block = blockFromProviderBlock(network, resultBlock)
      await this.db.addBlock(block)

      await this.emitter.emit("block", block)
      return block
    } catch (e) {
      logger.error(e)
      throw new Error(`Failed to get block`)
    }
  }

  async pollBlockPrices(): Promise<void> {
    for (let i = 1; i < GAS_POLLS_PER_PERIOD; i += 1) {
      setTimeout(async () => {
        await Promise.allSettled(
          this.chainService.subscribedNetworks.map(async ({ network }) =>
            this.pollBlockPricesForNetwork(network.chainID)
          )
        )
      }, (GAS_POLLING_PERIOD / GAS_POLLS_PER_PERIOD) * (GAS_POLLING_PERIOD * MINUTE) * i)
    }

    // Immediately run the first poll
    await Promise.allSettled(
      this.chainService.subscribedNetworks.map(async ({ network }) =>
        this.pollBlockPricesForNetwork(network.chainID)
      )
    )
  }

  async getBlockPrices(
    network: NetworkInterface,
    provider: JsonRpcProvider,
    shard: Shard
  ): Promise<BlockPrices> {
    const zone = toZone(shard)
    const [currentBlock, feeData] = await Promise.all([
      provider.getBlock(shard, "latest"),
      provider.getFeeData(zone),
    ])
    const baseFeePerGas = currentBlock?.header.baseFeePerGas

    if (feeData.gasPrice === null) {
      logger.warn("Not receiving accurate gas prices from provider", feeData)
    }

    const gasPrice = feeData?.gasPrice || 0n

    if (baseFeePerGas) {
      return {
        network,
        blockNumber: Number(currentBlock.header.number[2]),
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
      blockNumber: Number(currentBlock?.header.number[2]),
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

  async pollBlockPricesForNetwork(chainID: string): Promise<void> {
    const subscription = this.chainService.subscribedNetworks.find(
      ({ network }) => toHexChainID(network.chainID) === toHexChainID(chainID)
    )

    if (!subscription) {
      logger.warn(
        `Can't fetch block prices for unsubscribed chainID ${chainID}`
      )
      return
    }

    const { address } = await this.preferenceService.getSelectedAccount()
    const shard = getExtendedZoneForAddress(address, false) as Shard

    if (!shard) {
      logger.warn(`Can't get shard for ${address}`)
      return
    }
    const blockPrices = await this.getBlockPrices(
      subscription.network,
      subscription.provider,
      shard
    )
    await this.emitter.emit("blockPrices", {
      blockPrices,
      network: subscription.network,
    })
  }
}
