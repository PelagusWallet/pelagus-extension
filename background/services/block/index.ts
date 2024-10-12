import { JsonRpcProvider, Shard, toZone } from "quais"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import logger from "../../lib/logger"
import { AnyEVMBlock, BlockPrices } from "../../networks"
import PreferenceService from "../preferences"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import BaseService from "../base"
import { blockFromProviderBlock } from "./utils"
import ChainService from "../chain"
import { BlockDatabase, initializeBlockDatabase } from "./db"
import { getExtendedZoneForAddress } from "../chain/utils"

const GAS_POLLS_PER_PERIOD = 1 // 1 time per 5 minutes

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
          periodInMinutes: GAS_POLLS_PER_PERIOD,
        },
        handler: () => {
          this.pollBlockPrices()
        },
      },
    })
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()
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
      const { jsonRpcProvider } = this.chainService

      const shard = getExtendedZoneForAddress(address, false) as Shard

      const latestBlock = await jsonRpcProvider.getBlock(shard, "latest")
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
    this.chainService.subscribedNetworks.forEach((subscribedNetworks) => {
      this.pollBlockPricesForNetwork(subscribedNetworks)
    })
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

    if (feeData.gasPrice === null) {
      logger.warn("Not receiving accurate gas prices from provider", feeData)
    }

    const gasPrice = feeData?.gasPrice || 10000000n
    const minerTip = feeData?.minerTip || 0n

    return {
      network,
      blockNumber: Number(currentBlock?.header.number[2]),
      baseFeePerGas: gasPrice,
      estimatedPrices: [
        {
          confidence: 99,
          minerTip: minerTip * 2n,
          gasPrice,
        },
        {
          confidence: 95,
          minerTip: (minerTip * 3n) / 2n,
          gasPrice,
        },
        {
          confidence: 70,
          minerTip,
          gasPrice,
        },
      ],
      dataSource: "local",
    }
  }

  async pollBlockPricesForNetwork(subscribedNetworks: {
    network: NetworkInterface
    provider?: JsonRpcProvider
  }): Promise<void> {
    const { jsonRpcProvider } = this.chainService
    const { network, provider = jsonRpcProvider } = subscribedNetworks

    const { address } = await this.preferenceService.getSelectedAccount()
    const shard = getExtendedZoneForAddress(address, false) as Shard

    if (!shard) {
      logger.warn(`Can't get shard for ${address}`)
      return
    }
    const blockPrices = await this.getBlockPrices(network, provider, shard)
    await this.emitter.emit("blockPrices", {
      blockPrices,
      network,
    })
  }
}
