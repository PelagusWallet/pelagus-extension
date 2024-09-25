import Dexie, { DexieOptions } from "dexie"

import { AnyEVMBlock } from "../../networks"
import { NetworkInterface } from "../../constants/networks/networkTypes"

export class BlockDatabase extends Dexie {
  private blocks!: Dexie.Table<AnyEVMBlock, [string, string]>

  constructor(options?: DexieOptions) {
    super("pelagus/blocks", options)
    this.version(1).stores({
      migrations: null,
      blocks:
        "&[hash+network.baseAsset.name],[network.baseAsset.name+timestamp],hash,network.baseAsset.name,timestamp,parentHash,blockHeight,[blockHeight+network.baseAsset.name]",
    })
  }

  async getLatestBlock(network: NetworkInterface): Promise<AnyEVMBlock | null> {
    return (
      (
        await this.blocks
          .where("[network.baseAsset.name+timestamp]")
          // Only query blocks from the last 86 seconds
          .aboveOrEqual([network.baseAsset.name, Date.now() - 60 * 60 * 24])
          .and(
            (block) => block.network.baseAsset.name === network.baseAsset.name
          )
          .reverse()
          .sortBy("timestamp")
      )[0] || null
    )
  }

  async getBlock(
    network: NetworkInterface,
    blockHash: string
  ): Promise<AnyEVMBlock | null> {
    return (
      (
        await this.blocks
          .where("[hash+network.baseAsset.name]")
          .equals([blockHash, network.baseAsset.name])
          .toArray()
      )[0] || null
    )
  }

  async addBlock(block: AnyEVMBlock): Promise<void> {
    await this.blocks.put(block)
  }
}

export function initializeBlockDatabase(options?: DexieOptions): BlockDatabase {
  return new BlockDatabase(options)
}
