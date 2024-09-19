import Dexie, { DexieOptions } from "dexie"
import { UNIXTime } from "../../types"
import { AccountBalance, AddressOnNetwork } from "../../accounts"
import { NetworkBaseAsset } from "../../networks"
import { FungibleAsset } from "../../assets"
import { BASE_ASSETS } from "../../constants"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { NetworksArray } from "../../constants/networks/networks"

type AccountAssetTransferLookup = {
  addressNetwork: AddressOnNetwork
  retrievedAt: UNIXTime
  startBlock: bigint
  endBlock: bigint
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

  private networks!: Dexie.Table<NetworkInterface, string>

  private baseAssets!: Dexie.Table<NetworkBaseAsset, string>

  constructor(options?: DexieOptions) {
    super("tally/chain", options)
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
}

export function createDB(options?: DexieOptions): ChainDatabase {
  return new ChainDatabase(options)
}
