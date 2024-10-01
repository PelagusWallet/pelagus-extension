import Dexie, { DexieOptions } from "dexie"
import { TokenList } from "@uniswap/token-lists"

import {
  FungibleAsset,
  NetworkSpecificAssetMetadata,
  PricePoint,
  SmartContractFungibleAsset,
  TokenListCitation,
} from "../../assets"
import { AccountBalance } from "../../accounts"
import { NetworkInterface } from "../../constants/networks/networkTypes"

/*
 * IndexedPricePoint extends PricePoint to expose each asset's ID directly for
 * database index purposes.
 */
export type IndexedPricePoint = PricePoint & {
  asset1ID: string
  asset2ID: string
}

/*
 * PriceMeasurement is a IndexedPricePoint extension with additional bookkeeping
 * to keep track of how the price was measured and saved.
 */
export type PriceMeasurement = IndexedPricePoint & {
  /*
   * When the price was retrieved, independent from the time which the
   * PricePoint purportis to represent.
   */
  retrievedAt: number
  /*
   * An optional exchange identifier.
   */
  exchange?: string
}

/*
 * CachedTokenList combines the specificty of TokenListCitation as a way to
 * reference a token list with actual token list, as well as a retrieval date.
 *
 * This detail will allow for disambiguation in case a token list publisher has
 * issues with backdating or improperly incremented version numbers.
 */
export type CachedTokenList = TokenListCitation & {
  retrievedAt: number
  list: TokenList
}

/*
 * CustomAsset provides the ability to mark an asset as removed in the database.
 * This state should only be stored in the db and not percolated to the user interface.
 * The UI sees the asset as actually removed but the db tracks that it once existed and was removed.
 * Used only for checking if an unverified, discovered (not added) asset should be added to the asset list.
 *
 */
export type CustomAsset = Omit<SmartContractFungibleAsset, "metadata"> & {
  metadata?: NetworkSpecificAssetMetadata & { removed?: boolean }
}

function numberArrayCompare(arr1: number[], arr2: number[]) {
  for (let i = 0; i < arr1.length; i += 1) {
    if (arr1[i] > arr2[i]) {
      return 1
    }
    if (arr1[i] < arr2[i]) {
      return -1
    }
  }
  return 0
}

export class IndexingDatabase extends Dexie {
  private prices!: Dexie.Table<PriceMeasurement, number>

  /*
   * Historic account balances.
   */
  private balances!: Dexie.Table<AccountBalance, number>

  /*
   * Cached token lists maintaining fungible asset metadata.
   */
  private tokenLists!: Dexie.Table<CachedTokenList, number>

  /*
   * User- and contract-supplied fungible asset metadata.
   */
  private customAssets!: Dexie.Table<CustomAsset, number>

  /*
   * Tokens whose balances should be checked periodically. It might make sense
   * for this to be tracked against particular accounts in the future.
   */
  private assetsToTrack!: Dexie.Table<SmartContractFungibleAsset, number>

  constructor(options?: DexieOptions) {
    super("pelagus/indexing", options)
    this.version(1).stores({
      migrations: "++id,appliedAt",
      prices: "++id,time,[asset1ID+asset2ID]",
      // TODO: Keep on eye: possible problem if on one chain we have two tokens with the same symbols
      balances:
        "[address+assetAmount.asset.symbol+network.chainID],address,assetAmount.amount,assetAmount.asset.symbol,network.baseAsset.name,blockHeight,retrievedAt",
      tokenLists: "++id,url,retrievedAt",
      customAssets:
        "&[contractAddress+homeNetwork.baseAsset.name],contractAddress,symbol,homeNetwork.chainID,homeNetwork.baseAsset.name",
      assetsToTrack:
        "&[contractAddress+homeNetwork.baseAsset.name],symbol,contractAddress,homeNetwork.family,homeNetwork.chainID,homeNetwork.baseAsset.name",
    })
  }

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

  async addAssetToTrack(asset: SmartContractFungibleAsset): Promise<void> {
    this.assetsToTrack.put(asset)
  }

  async getAssetsToTrack(): Promise<SmartContractFungibleAsset[]> {
    // TODO move "assets to track" to expire over time and require a refresh
    // to keep from balance checking tons of irrelevant tokens
    // see https://github.com/tallycash/tally-extension/issues/136 for details
    return this.assetsToTrack.toArray()
  }

  async isTrackingAsset(asset: SmartContractFungibleAsset): Promise<boolean> {
    return (
      (await this.getTrackedAssetByAddressAndNetwork(
        asset.homeNetwork,
        asset.contractAddress
      )) !== undefined
    )
  }

  async getActiveCustomAssetsByNetworks(
    networks: NetworkInterface[]
  ): Promise<CustomAsset[]> {
    return (
      await this.customAssets
        .where("homeNetwork.chainID")
        .anyOf(networks.map((network) => network.chainID))
        .toArray()
    ).filter((asset) => asset?.metadata?.removed !== true)
  }

  async getCustomAssetByAddressAndNetwork(
    network: NetworkInterface,
    contractAddress: string
  ): Promise<CustomAsset | undefined> {
    return this.customAssets
      .where("[contractAddress+homeNetwork.baseAsset.name]")
      .equals([contractAddress, network.baseAsset.name])
      .first()
  }

  async getTrackedAssetByAddressAndNetwork(
    network: NetworkInterface,
    contractAddress: string
  ): Promise<SmartContractFungibleAsset | undefined> {
    return this.assetsToTrack
      .where("[contractAddress+homeNetwork.baseAsset.name]")
      .equals([contractAddress, network.baseAsset.name])
      .first()
  }

  async addOrUpdateCustomAsset(
    asset: SmartContractFungibleAsset
  ): Promise<void> {
    this.customAssets.put(asset)
  }

  async addBalances(accountBalances: AccountBalance[]): Promise<void> {
    await this.balances.bulkPut(accountBalances)
  }

  async getLatestTokenList(url: string): Promise<CachedTokenList | null> {
    const candidateLists = await this.tokenLists
      .where("url")
      .equals(url)
      .reverse()
      .sortBy("retrievedAt")
    if (candidateLists.length > 0) return candidateLists[0]

    return null
  }

  async saveTokenList(url: string, list: TokenList): Promise<void> {
    const cachedList = {
      name: list.name,
      logoURL: list.logoURI,
      url,
      retrievedAt: Date.now(),
      list,
    }
    await this.tokenLists.add(cachedList)
  }

  async getLatestTokenLists(
    urls: string[]
  ): Promise<{ url: string; tokenList: TokenList }[]> {
    const candidateLists = (await this.tokenLists
      .where("url")
      .anyOf(urls)
      .toArray()) as CachedTokenList[]
    return Object.entries(
      candidateLists.reduce((acc, cachedList) => {
        if (!(cachedList.url in acc)) {
          acc[cachedList.url] = cachedList.list
        } else {
          const orig = acc[cachedList.url]
          const origV = [
            orig.version.major,
            orig.version.minor,
            orig.version.patch,
          ]
          const cachedV = [
            cachedList.list.version.major,
            cachedList.list.version.minor,
            cachedList.list.version.patch,
          ]
          if (numberArrayCompare(origV, cachedV) < 0) {
            acc[cachedList.url] = cachedList.list
          }
        }
        return { ...acc }
      }, {} as { [url: string]: TokenList })
    ).map(([k, v]) => ({
      url: k,
      tokenList: v as TokenList,
    }))
  }
}

export async function initializeIndexingDatabase(
  options?: DexieOptions
): Promise<IndexingDatabase> {
  return new IndexingDatabase(options)
}
