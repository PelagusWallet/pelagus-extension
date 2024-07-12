import Dexie, { DexieOptions, IndexableTypeArray } from "dexie"
import { UNIXTime } from "../../types"
import { AccountBalance, AddressOnNetwork } from "../../accounts"
import { AnyEVMBlock, NetworkBaseAsset } from "../../networks"
import { FungibleAsset } from "../../assets"
import { BASE_ASSETS } from "../../constants"
import { NetworkInterfaceGA } from "../../constants/networks/networkTypes"
import { NetworksArray } from "../../constants/networks/networks"
import { QuaiTransactionStatus, SerializedTransactionForHistory } from "./types"

type AdditionalTransactionFieldsForDB = {
  dataSource: "local"
  firstSeen: UNIXTime
}

export type QuaiTransactionDBEntry = SerializedTransactionForHistory &
  AdditionalTransactionFieldsForDB

type AccountAssetTransferLookup = {
  addressNetwork: AddressOnNetwork
  retrievedAt: UNIXTime
  startBlock: bigint
  endBlock: bigint
}

// TODO keep track of blocks invalidated by a reorg
// TODO keep track of transaction replacement
export class ChainDatabase extends Dexie {
  /*
   * Accounts whose transaction and balances should be tracked on a particular
   * network.
   *
   * Keyed by the [address, network name, network chain ID] triplet.
   */
  private accountsToTrack!: Dexie.Table<
    AddressOnNetwork,
    [string, string, string]
  >

  /**
   * Keep track of details of asset transfers we've looked up before per
   * account.
   */
  private accountAssetTransferLookups!: Dexie.Table<
    AccountAssetTransferLookup,
    [number]
  >

  /*
   * Partial block headers cached to track reorgs and network status.
   *
   * Keyed by the [block hash, network name] pair.
   */
  private blocks!: Dexie.Table<AnyEVMBlock, [string, string]>

  /*
   * Quai transactions relevant to tracked accounts.
   *
   * Keyed by the [transaction hash, network chainID] pair.
   */
  private quaiTransactions!: Dexie.Table<
    QuaiTransactionDBEntry,
    [string, string]
  >

  /*
   * Historic account balances.
   */
  private balances!: Dexie.Table<AccountBalance, number>

  private networks!: Dexie.Table<NetworkInterfaceGA, string>

  private baseAssets!: Dexie.Table<NetworkBaseAsset, string>

  constructor(options?: DexieOptions) {
    super("tally/chain", options)
    this.version(1).stores({
      migrations: null,
      accountsToTrack:
        "&[address+network.baseAsset.name+network.chainID],address,network.family,network.chainID,network.baseAsset.name",
      accountAssetTransferLookups:
        "++id,[addressNetwork.address+addressNetwork.network.baseAsset.name+addressNetwork.network.chainID],[addressNetwork.address+addressNetwork.network.baseAsset.name+addressNetwork.network.chainID+startBlock],[addressNetwork.address+addressNetwork.network.baseAsset.name+addressNetwork.network.chainID+endBlock],addressNetwork.address,addressNetwork.network.chainID,addressNetwork.network.baseAsset.name,startBlock,endBlock",
      balances:
        "++id,address,assetAmount.amount,assetAmount.asset.symbol,network.baseAsset.name,blockHeight,retrievedAt",
      quaiTransactions:
        "&[hash+chainId],hash,from,[from+chainId],to,[to+chainId],nonce,[nonce+from+chainId],blockHash,blockNumber,chainId,firstSeen,dataSource",
      blocks:
        "&[hash+network.baseAsset.name],[network.baseAsset.name+timestamp],hash,network.baseAsset.name,timestamp,parentHash,blockHeight,[blockHeight+network.baseAsset.name]",
      networks: "&chainID,baseAsset.name,family",
      baseAssets: "&chainID,symbol,name",
    })

    this.quaiTransactions.hook(
      "updating",
      (modifications, _, chainTransaction) => {
        // Only these properties can be updated on a stored transaction.
        // NOTE: Currently we do NOT throw if another property modification is
        // attempted; instead, we just ignore it.
        const allowedVariants = ["blockHeight", "blockHash", "firstSeen"]

        const filteredModifications = Object.fromEntries(
          Object.entries(modifications).filter(([k]) =>
            allowedVariants.includes(k)
          )
        )

        // If there is an attempt to modify `firstSeen`, prefer the earliest
        // first seen value between the update and the existing value.
        if ("firstSeen" in filteredModifications) {
          return {
            ...filteredModifications,
            firstSeen: Math.min(
              chainTransaction.firstSeen,
              filteredModifications.firstSeen
            ),
          }
        }

        return filteredModifications
      }
    )
  }

  async initialize(): Promise<void> {
    await this.initializeBaseAssets()
    await this.initializeNetworks()
  }

  /** NETWORKS */

  async initializeNetworks(): Promise<void> {
    const existingQuaiNetworks = await this.getAllQuaiNetworks()
    await Promise.all(
      NetworksArray.map(async (defaultNetwork) => {
        if (
          !existingQuaiNetworks.some(
            (network) => network.chainID === defaultNetwork.chainID
          )
        ) {
          await this.networks.put(defaultNetwork)
        }
      })
    )
  }

  async getAllQuaiNetworks(): Promise<NetworkInterfaceGA[]> {
    return this.networks.where("family").equals("EVM").toArray()
  }

  async getChainIDsToTrack(): Promise<Set<string>> {
    const chainIDs = await this.accountsToTrack
      .orderBy("network.chainID")
      .keys()
    return new Set(
      chainIDs.filter(
        (chainID): chainID is string => typeof chainID === "string"
      )
    )
  }

  /** BLOCKS */

  async getLatestBlock(
    network: NetworkInterfaceGA
  ): Promise<AnyEVMBlock | null> {
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
    network: NetworkInterfaceGA,
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
    // TODO Consider exposing whether the block was added or updated.
    // TODO Consider tracking history of block changes, e.g. in case of reorg.
    await this.blocks.put(block)
  }

  /** ASSETS */

  async getBaseAssetForNetwork(chainID: string): Promise<NetworkBaseAsset> {
    const baseAsset = await this.baseAssets.get(chainID)
    if (!baseAsset) {
      throw new Error(`No Base Asset Found For Network ${chainID}`)
    }
    return baseAsset
  }

  async initializeBaseAssets(): Promise<void> {
    await this.updateBaseAssets(BASE_ASSETS)
  }

  async getOldestAccountAssetTransferLookup(
    addressNetwork: AddressOnNetwork
  ): Promise<bigint | null> {
    // TODO this is inefficient, make proper use of indexing
    const lookups = await this.accountAssetTransferLookups
      .where("[addressNetwork.address+addressNetwork.network.baseAsset.name]")
      .equals([addressNetwork.address, addressNetwork.network.baseAsset.name])
      .toArray()
    return lookups.reduce(
      (oldestBlock: bigint | null, lookup) =>
        oldestBlock === null || lookup.startBlock < oldestBlock
          ? lookup.startBlock
          : oldestBlock,
      null
    )
  }

  async updateBaseAssets(baseAssets: NetworkBaseAsset[]): Promise<void> {
    await this.baseAssets.bulkPut(baseAssets)
  }

  /** ACCOUNTS */

  async getLatestAccountBalance(
    address: string,
    network: NetworkInterfaceGA,
    asset: FungibleAsset
  ): Promise<AccountBalance | null> {
    // TODO this needs to be tightened up, both for performance and specificity
    const balanceCandidates = await this.balances
      .where("retrievedAt")
      .above(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .filter(
        (balance) =>
          balance.address === address &&
          balance.assetAmount.asset.symbol === asset.symbol &&
          balance.network.baseAsset.name === network.baseAsset.name
      )
      .reverse()
      .sortBy("retrievedAt")
    return balanceCandidates.length > 0 ? balanceCandidates[0] : null
  }

  async addAccountToTrack(addressNetwork: AddressOnNetwork): Promise<void> {
    await this.accountsToTrack.put(addressNetwork)
  }

  async removeAccountToTrack(address: string): Promise<void> {
    // @TODO Network Specific deletion when we support it.
    await this.accountsToTrack.where("address").equals(address).delete()
  }

  async getNewestAccountAssetTransferLookup(
    addressNetwork: AddressOnNetwork
  ): Promise<bigint | null> {
    // TODO this is inefficient, make proper use of indexing
    const lookups = await this.accountAssetTransferLookups
      .where("[addressNetwork.address+addressNetwork.network.baseAsset.name]")
      .equals([addressNetwork.address, addressNetwork.network.baseAsset.name])

      .toArray()
    return lookups.reduce(
      (newestBlock: bigint | null, lookup) =>
        newestBlock === null || lookup.endBlock > newestBlock
          ? lookup.endBlock
          : newestBlock,
      null
    )
  }

  async recordAccountAssetTransferLookup(
    addressNetwork: AddressOnNetwork,
    startBlock: bigint,
    endBlock: bigint
  ): Promise<void> {
    await this.accountAssetTransferLookups.add({
      addressNetwork,
      startBlock,
      endBlock,
      retrievedAt: Date.now(),
    })
  }

  async addBalance(accountBalance: AccountBalance): Promise<void> {
    await this.balances.add(accountBalance)
  }

  async getAccountsToTrack(): Promise<AddressOnNetwork[]> {
    return this.accountsToTrack.toArray()
  }

  async getTrackedAddressesOnNetwork(
    network: NetworkInterfaceGA
  ): Promise<AddressOnNetwork[]> {
    return this.accountsToTrack
      .where("network.baseAsset.name")
      .equals(network.baseAsset.name)
      .toArray()
  }

  async getTrackedAccountOnNetwork({
    address,
    network,
  }: AddressOnNetwork): Promise<AddressOnNetwork | null> {
    return (
      (
        await this.accountsToTrack
          .where("[address+network.baseAsset.name+network.chainID]")
          .equals([address, network.baseAsset.name, network.chainID])
          .toArray()
      )[0] ?? null
    )
  }

  /** TRANSACTIONS */

  async getAllQuaiTransactions(): Promise<QuaiTransactionDBEntry[]> {
    return this.quaiTransactions.toArray()
  }

  async getAllQuaiTransactionHashes(): Promise<IndexableTypeArray> {
    return this.quaiTransactions.orderBy("hash").keys()
  }

  async getQuaiTransactionByHash(
    txHash: string | null | undefined
  ): Promise<QuaiTransactionDBEntry | null> {
    if (!txHash) return null

    return (
      (await this.quaiTransactions.where("hash").equals(txHash).toArray())[0] ||
      null
    )
  }

  async getQuaiTransactionsByNetwork(
    network: NetworkInterfaceGA
  ): Promise<QuaiTransactionDBEntry[]> {
    const transactions = this.quaiTransactions
      .where("chainId")
      .equals(network.chainID)

    return transactions.toArray()
  }

  async getQuaiTransactionsByStatus(
    network: NetworkInterfaceGA,
    status: QuaiTransactionStatus
  ): Promise<QuaiTransactionDBEntry[]> {
    const transactions = this.quaiTransactions
      .where("[chainId+status]")
      .equals([network.chainID, status])

    return transactions.toArray()
  }

  async addOrUpdateQuaiTransaction(
    tx: SerializedTransactionForHistory,
    dataSource: QuaiTransactionDBEntry["dataSource"]
  ): Promise<void> {
    try {
      const existingTx = await this.getQuaiTransactionByHash(tx.hash)

      console.log("existingTx", existingTx)

      const mergedTx = {
        ...tx,
        ...existingTx,
      } as SerializedTransactionForHistory

      console.log("updatedTx", mergedTx)

      if (!mergedTx) {
        throw new Error("Failed to get quai transaction by hash from DB")
      }

      await this.transaction("rw", this.quaiTransactions, async () => {
        await this.quaiTransactions.put({
          ...mergedTx,
          dataSource,
          firstSeen: Date.now(),
        })
      })

      console.log("Transaction successfully added or updated")
    } catch (error: any) {
      throw new Error(`Failed to add or update quai transaction: ${error}`)
    }
  }

  async deleteQuaiTransactionsByAddress(address: string): Promise<void> {
    const txs = await this.getAllQuaiTransactions()

    const deletePromises = txs.map(async () => {
      await this.quaiTransactions.where("from").equals(address).delete()

      await this.quaiTransactions.where("to").equals(address).delete()
    })

    await Promise.all(deletePromises)
  }
}

export function createDB(options?: DexieOptions): ChainDatabase {
  return new ChainDatabase(options)
}
