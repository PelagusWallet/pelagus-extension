import { JsonRpcProvider, Shard, toZone, WebSocketProvider, Zone } from "quais"
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

interface Events extends ServiceLifecycleEvents {
  block: AnyEVMBlock
  blockPrices: { blockPrices: BlockPrices; network: NetworkInterface }
}

export default class BlockService extends BaseService<Events> {
  private newHeadProvider?: WebSocketProvider

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
    super()
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()
    await this.subscribeToNewHeads()
  }

  override async internalStopService(): Promise<void> {
    if (this.newHeadProvider) {
      try {
        await this.newHeadProvider.off(
          "block",
          this.handleNewHead,
          Zone.Cyprus1
        )
      } catch (error) {
        logger.warn("Failed to remove new-head subscription", error)
      }
      this.newHeadProvider = undefined
    }
    await super.internalStopService()
  }

  async getBlockHeight(network: NetworkInterface): Promise<number> {
    try {
      const observedBlockHeight =
        globalThis.main.store.getState().networks.blockInfo[network.chainID]
          ?.blockHeight
      if (typeof observedBlockHeight === "number") return observedBlockHeight

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

  private handleNewHead = async (blockNumber: number): Promise<void> => {
    const block: AnyEVMBlock = {
      hash: "",
      parentHash: "",
      blockHeight: blockNumber,
      difficulty: 0n,
      timestamp: Date.now(),
      baseFeePerGas: 0n,
      network: this.chainService.selectedNetwork,
    }
    await this.emitter.emit("block", block)
  }

  async subscribeToNewHeads(): Promise<void> {
    const provider = this.chainService.webSocketProvider
    if (provider === this.newHeadProvider) return

    if (this.newHeadProvider) {
      try {
        await this.newHeadProvider.off(
          "block",
          this.handleNewHead,
          Zone.Cyprus1
        )
      } catch (error) {
        logger.warn("Failed to move new-head subscription", error)
      }
      this.newHeadProvider = undefined
    }
    await provider.on("block", this.handleNewHead, Zone.Cyprus1)
    this.newHeadProvider = provider
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
    const { network } = await this.preferenceService.getSelectedAccount()
    await this.pollBlockPricesForNetwork({ network })
  }

  async getBlockPrices(
    network: NetworkInterface,
    provider: JsonRpcProvider,
    shard: Shard
  ): Promise<BlockPrices> {
    const zone = toZone(shard)
    const feeData = await provider.getFeeData(zone)

    if (feeData.gasPrice === null) {
      logger.warn("Not receiving accurate gas prices from provider", feeData)
    }

    const gasPrice = feeData?.gasPrice || 10000000n
    const blockNumber =
      this.chainService.selectedNetwork.chainID === network.chainID
        ? globalThis.main.store.getState().networks.blockInfo[network.chainID]
            ?.blockHeight ?? 0
        : 0

    return {
      network,
      blockNumber,
      baseFeePerGas: gasPrice,
      estimatedPrices: [
        {
          confidence: 99,
          gasPrice,
        },
        {
          confidence: 95,
          gasPrice,
        },
        {
          confidence: 70,
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
