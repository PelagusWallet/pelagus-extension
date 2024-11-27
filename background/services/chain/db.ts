import Dexie, { DexieOptions } from "dexie"

import { UNIXTime } from "../../types"
import {
  AccountBalance,
  AddressOnNetwork,
  QiCoinbaseAddressBalance,
  QiWalletSyncInfo,
  QiWalletBalance,
} from "../../accounts"
import { NetworkBaseAsset } from "../../networks"
import { FungibleAsset } from "../../assets"
import { BASE_ASSETS } from "../../constants"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { PELAGUS_NETWORKS } from "../../constants/networks/networks"
import { Outpoint } from "quais/lib/commonjs/transaction/utxo"
import { getExtendedZoneForAddress } from "./utils"
import { Zone } from "quais"
import logger from "../../lib/logger"

type AccountAssetTransferLookup = {
  addressNetwork: AddressOnNetwork
  retrievedAt: UNIXTime
  startBlock: bigint
  endBlock: bigint
}

export type QiOutpoint = {
  outpoint: Outpoint
  value: bigint // value in qits
  address: string
  chainID: string
}

// TODO keep track of blocks invalidated by a reorg
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
   * Historic account balances.
   */
  private balances!: Dexie.Table<AccountBalance, number>

  private qiLedgerBalance!: Dexie.Table<QiWalletBalance, number>

  private networks!: Dexie.Table<NetworkInterface, string>

  private baseAssets!: Dexie.Table<NetworkBaseAsset, string>

  private qiCoinbaseAddressBalances!: Dexie.Table<
    QiCoinbaseAddressBalance,
    number
  >

  private qiOutpoints!: Dexie.Table<QiOutpoint, [string, string, number]>

  private qiWalletSyncInfo!: Dexie.Table<QiWalletSyncInfo, string>

  constructor(options?: DexieOptions) {
    super("pelagus/chain", options)
    this.version(1).stores({
      migrations: null,
      accountsToTrack:
        "&[address+network.baseAsset.name+network.chainID],address,network.family,network.chainID,network.baseAsset.name",
      accountAssetTransferLookups:
        "++id,[addressNetwork.address+addressNetwork.network.baseAsset.name+addressNetwork.network.chainID],[addressNetwork.address+addressNetwork.network.baseAsset.name+addressNetwork.network.chainID+startBlock],[addressNetwork.address+addressNetwork.network.baseAsset.name+addressNetwork.network.chainID+endBlock],addressNetwork.address,addressNetwork.network.chainID,addressNetwork.network.baseAsset.name,startBlock,endBlock",
      // TODO: Keep on eye: possible problem if on one chain we have two tokens with the same symbols
      balances:
        "[address+assetAmount.asset.symbol+network.chainID],address,assetAmount.amount,assetAmount.asset.symbol,network.baseAsset.name,blockHeight,retrievedAt",
      networks: "&chainID,baseAsset.name,family",
      baseAssets: "&chainID,symbol,name",
    })

    this.version(2).stores({
      qiLedgerBalance:
        "[paymentCode+assetAmount.asset.symbol+network.chainID],paymentCode,assetAmount.amount,assetAmount.asset.symbol,network.baseAsset.name,blockHeight,retrievedAt",
    })

    this.version(3).stores({
      qiCoinbaseAddressBalances:
        "&[address+chainID],address,chainID,balance,retrievedAt,dataSource",
    })

    this.version(4).stores({
      qiOutpoints:
        "&[chainID+outpoint.txhash+outpoint.index],[chainID+address+outpoint.txhash],[chainID+outpoint.lock],address,value,outpoint.txhash,outpoint.index,outpoint.denomination,outpoint.lock",
      qiWalletSyncInfo:
        "&[chainID+type],chainID,blockNumber,blockHash,timestamp,type",
    })
  }

  async initialize(): Promise<void> {
    await this.initializeBaseAssets()
    await this.initializeNetworks()
  }

  /** NETWORKS */
  async initializeNetworks(): Promise<void> {
    const existingQuaiNetworks = await this.getAllQuaiNetworks()
    await Promise.all(
      PELAGUS_NETWORKS.map(async (defaultNetwork) => {
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

  async getAllQuaiNetworks(): Promise<NetworkInterface[]> {
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
    network: NetworkInterface,
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

  async getLatestQiLedgerBalance(
    network: NetworkInterface
  ): Promise<QiWalletBalance | null> {
    const { chainID } = network

    return this.qiLedgerBalance
      .where("network.chainID")
      .equals(chainID)
      .reverse()
      .sortBy("retrievedAt")
      .then((sortedBalances) => sortedBalances[0] || null)
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
    await this.balances.put(accountBalance)
  }

  async addQiLedgerBalance(qiWalletBalance: QiWalletBalance): Promise<void> {
    await this.qiLedgerBalance.put(qiWalletBalance)
  }

  async getAccountsToTrack(): Promise<AddressOnNetwork[]> {
    return this.accountsToTrack.toArray()
  }

  async getTrackedAddressesOnNetwork(
    network: NetworkInterface
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

  async setQiCoinbaseAddressBalance(balance: {
    address: string
    balance: bigint
    chainID: string
  }): Promise<void> {
    await this.qiCoinbaseAddressBalances.put({
      ...balance,
      retrievedAt: Date.now(),
      dataSource: "local",
    })
  }

  async getQiCoinbaseAddressBalance(
    address: string,
    chainID: string
  ): Promise<bigint> {
    return BigInt(
      (
        await this.qiCoinbaseAddressBalances
          .where("[address+chainID]")
          .equals([address, chainID])
          .toArray()
      )[0]?.balance ?? "0"
    )
  }

  async getQiCoinbaseAddressBalances(
    chainID: string
  ): Promise<QiCoinbaseAddressBalance[]> {
    const balances = await this.qiCoinbaseAddressBalances
      .where("chainID")
      .equals(chainID)
      .toArray()
    return balances
  }

  async setQiLastFullScan(
    chainID: string,
    blockNumber: number,
    blockHash: string
  ): Promise<void> {
    await this.qiWalletSyncInfo.put({
      chainID,
      blockNumber,
      blockHash,
      timestamp: Date.now(),
      type: "scan",
    })
  }

  async getQiLastFullScan(
    chainID: string
  ): Promise<QiWalletSyncInfo | undefined> {
    return this.qiWalletSyncInfo.get([chainID, "scan"])
  }

  async setQiLastSync(
    chainID: string,
    blockNumber: number,
    blockHash: string
  ): Promise<void> {
    await this.qiWalletSyncInfo.put({
      chainID,
      blockNumber,
      blockHash,
      timestamp: Date.now(),
      type: "sync",
    })
  }

  async getQiLastSync(chainID: string): Promise<QiWalletSyncInfo | undefined> {
    return this.qiWalletSyncInfo.get([chainID, "sync"])
  }

  /**
   * Add QiOutpoints to the database efficiently, even for very large datasets.
   * @param outpoints - Array of QiOutpoint objects to insert.
   */
  async addQiOutpoints(outpoints: QiOutpoint[]): Promise<void> {
    const chunkSize = 10000 // Adjust this value based on performance testing
    try {
      await this.transaction("rw", this.qiOutpoints, async () => {
        for (let i = 0; i < outpoints.length; i += chunkSize) {
          const chunk = outpoints.slice(i, i + chunkSize)
          await this.qiOutpoints.bulkPut(chunk)
          // Optional: Yield to the event loop to keep UI responsive
          await Dexie.waitFor(
            () => new Promise((resolve) => setTimeout(resolve, 0))
          )
        }
      })
    } catch (error) {
      if (error instanceof Dexie.BulkError) {
        console.error(
          "Some QiOutpoints could not be added:",
          error.failures.length,
          "failures\n",
          error.failures,
          "\n",
          error
        )
        logger.error(
          "Some QiOutpoints could not be added:",
          error.failures.length,
          "failures\n",
          error.failures,
          "\n",
          error
        )
      } else {
        throw error
      }
    }
  }

  async removeQiOutpoints(outpoints: QiOutpoint[]): Promise<void> {
    const keys: [string, string, number][] = outpoints.map((outpoint) => [
      outpoint.chainID,
      outpoint.outpoint.txhash,
      outpoint.outpoint.index,
    ])

    await this.qiOutpoints.bulkDelete(keys)
  }

  async getAllQiOutpoints(chainID: string): Promise<QiOutpoint[]> {
    return this.qiOutpoints.where("chainID").equals(chainID).toArray()
  }

  async getUnlockedQiOutpoints(
    blockNumber: number,
    maxDenomination?: bigint
  ): Promise<QiOutpoint[]> {
    const query = this.qiOutpoints.where("outpoint.lock").below(blockNumber)

    if (maxDenomination) {
      query.and((outpoint) => outpoint.outpoint.denomination < maxDenomination)
    }

    return query.toArray()
  }

  async getQiOutpointsLessThanDenomination(
    denomination: bigint
  ): Promise<QiOutpoint[]> {
    return this.qiOutpoints
      .where("outpoint.denomination")
      .below(denomination)
      .toArray()
  }

  async loadQiOutpointsForSending(
    minimumAmt: bigint,
    chainID: string,
    currentBlockNumber: number
  ): Promise<QiOutpoint[]> {
    minimumAmt = minimumAmt * 3n // 3x buffer
    const outpoints: QiOutpoint[] = []
    let accumulatedValue = BigInt(0)
    const batchSize = 1000 // Adjust based on performance needs
    let lastKey = [chainID, Dexie.minKey]
    let hasMore = true

    while (hasMore && accumulatedValue < minimumAmt) {
      const batch = await this.qiOutpoints
        .where("[chainID+outpoint.lock]")
        .between(lastKey, [chainID, currentBlockNumber], false, true)
        .limit(batchSize)
        .toArray()

      if (batch.length === 0) {
        hasMore = false
        break
      }

      // Update lastKey for the next batch
      lastKey = [chainID, batch[batch.length - 1].outpoint.lock!]

      // Sort the batch by value in descending order
      batch.sort((a, b) => Number(b.value) - Number(a.value))

      for (const outpoint of batch) {
        outpoints.push(outpoint)
        accumulatedValue += outpoint.value
        if (accumulatedValue >= minimumAmt) {
          hasMore = false
          break
        }
      }
    }

    if (accumulatedValue < minimumAmt) {
      throw new Error(
        "Insufficient funds: not enough unlocked outpoints to cover the desired amount."
      )
    }

    return outpoints
  }

  /**
   * Get addresses that have more than `minTxCount` unique transactions in their outpoints.
   * This method efficiently queries the QiOutpoints table using indexed queries.
   *
   * @param chainID - The chain ID to query.
   * @param zone - The zone to filter addresses.
   * @param minTxCount - The minimum number of unique transactions required.
   * @param existingAddressesSet - A set of addresses to exclude (already existing coinbase addresses).
   * @returns A promise that resolves to an array of addresses matching the criteria.
   */
  async getPossibleCoinbaseAddressesFromOutpoints(
    chainID: string,
    zone: Zone,
    minTxCount: number,
    existingAddressesSet: Set<string>
  ): Promise<string[]> {
    const addressesSet = new Set<string>()
    const addressList = new Set<string>()

    // Collect unique addresses matching the criteria
    await this.qiOutpoints
      .where("chainID")
      .equals(chainID)
      .and((outpoint) => {
        return (
          getExtendedZoneForAddress(outpoint.address) === zone &&
          !existingAddressesSet.has(outpoint.address)
        )
      })
      .each((outpoint) => {
        addressList.add(outpoint.address)
      })

    // For each address, count unique transaction hashes
    await Promise.all(
      Array.from(addressList).map(async (address) => {
        const keys = await this.qiOutpoints
          .where("[chainID+address+outpoint.txhash]")
          .between(
            [chainID, address, Dexie.minKey],
            [chainID, address, Dexie.maxKey]
          )
          .primaryKeys()

        // Extract unique transaction hashes
        const txhashesSet = new Set(keys.map((key) => key[1])) // key[1] is outpoint.txhash

        if (txhashesSet.size > minTxCount) {
          addressesSet.add(address)
        }
      })
    )

    return Array.from(addressesSet)
  }
}

export function initializeChainDatabase(options?: DexieOptions): ChainDatabase {
  return new ChainDatabase(options)
}
