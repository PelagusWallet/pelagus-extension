import { getAddress } from "quais"
import logger from "../../lib/logger"
import { HexString } from "../../types"
import { sameNetwork } from "../../networks"
import {
  AccountBalance,
  AddressOnNetwork,
  QiCoinbaseAddress,
} from "../../accounts"
import {
  AnyAsset,
  AnyAssetMetadata,
  FungibleAsset,
  isSmartContractFungibleAsset,
  PricePoint,
  SmartContractAmount,
  SmartContractFungibleAsset,
} from "../../assets"
import { HOUR, MINUTE, NETWORK_BY_CHAIN_ID } from "../../constants"
import {
  fetchAndValidateTokenList,
  mergeAssets,
  networkAssetsFromLists,
} from "../../lib/token-lists"
import PreferenceService from "../preferences"
import ChainService from "../chain"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import { CustomAsset, initializeIndexingDatabase, IndexingDatabase } from "./db"
import BaseService from "../base"
import { sameQuaiAddress } from "../../lib/utils"
import { getExtendedZoneForAddress, getNetworkById } from "../chain/utils"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { isQuaiHandle } from "../../constants/networks/networkUtils"
import { PELAGUS_NETWORKS } from "../../constants/networks/networks"
import BlockService from "../block"
import TransactionService from "../transactions"
import { EnrichedQuaiTransaction } from "../transactions/types"

// Transactions seen within this many blocks of the chain tip will schedule a
// token refresh sooner than the standard rate.
const FAST_TOKEN_REFRESH_BLOCK_RANGE = 10
// The number of ms to coalesce tokens whose balances are known to have changed
// before balance-checking them.
const ACCELERATED_TOKEN_REFRESH_TIMEOUT = 3000

interface Events extends ServiceLifecycleEvents {
  accountsWithBalances: {
    /**
     * Retrieved token balances
     */
    balances: AccountBalance[]
    /**
     * The respective address and network for these balances,
     * useful for identifying which account has no balances left
     * when the balances array is empty
     */
    addressOnNetwork: AddressOnNetwork
  }
  prices: PricePoint[]
  assets: AnyAsset[]
  refreshAsset: SmartContractFungibleAsset
  removeAssetData: SmartContractFungibleAsset
  qiCoinbaseAddresses: QiCoinbaseAddress[]
}

/**
 * IndexingService is responsible for pulling and maintaining all application-
 * level "indexing" data — things like fungible token balances and NFTs, as well
 * as more abstract application concepts like governance proposals.
 *
 * Today, the service periodically polls for price and token balance
 * changes for all tracked tokens and accounts, as well as up to date
 * token metadata. Relevant prices and balances are emitted as events.
 */
export default class IndexingService extends BaseService<Events> {
  /**
   * True if an off-cycle token refresh was scheduled, typically when a watched
   * account had a transaction confirmed.
   */
  private scheduledTokenRefresh = false

  private cachedAssets: Record<NetworkInterface["chainID"], AnyAsset[]> =
    Object.fromEntries(
      Object.keys(NETWORK_BY_CHAIN_ID).map((network) => [network, []])
    )

  /**
   * Create a new IndexingService. The service isn't initialized until
   * startService() is called and resolved.
   *
   * @param preferenceService - Required for token metadata and currency
   *        preferences.
   * @param chainService - Required for chain interactions.
   * @returns A new, initializing IndexingService
   */
  static create: ServiceCreatorFunction<
    Events,
    IndexingService,
    [
      Promise<PreferenceService>,
      Promise<ChainService>,
      Promise<TransactionService>,
      Promise<BlockService>
    ]
  > = async (
    preferenceService,
    chainService,
    transactionService,
    blockService,
    dexieOptions
  ) => {
    return new this(
      await initializeIndexingDatabase(dexieOptions),
      await preferenceService,
      await chainService,
      await transactionService,
      await blockService
    )
  }

  private constructor(
    private db: IndexingDatabase,
    private preferenceService: PreferenceService,
    private chainService: ChainService,
    private transactionService: TransactionService,
    private blockService: BlockService
  ) {
    super({
      balance: {
        schedule: {
          periodInMinutes: 1,
        },
        handler: () => this.handleBalanceAlarm(),
      },
      forceBalance: {
        schedule: {
          periodInMinutes: (12 * HOUR) / MINUTE,
        },
        handler: () => this.handleBalanceAlarm(),
      },
      balanceRefresh: {
        schedule: {
          periodInMinutes: 1,
        },
        handler: () => this.handleBalanceRefresh(),
      },
    })
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()
    this.connectChainServiceEvents()

    // Kick off token list fetching in the background
    const tokenListLoad = this.fetchAndCacheTokenLists()

    this.chainService.emitter.once("serviceStarted").then(async () => {
      Promise.allSettled(
        PELAGUS_NETWORKS.map(async (network) => {
          await this.cacheAssetsForNetwork(network)
          this.emitter.emit("assets", this.getCachedAssets(network))
        })
        // Load balances after token lists load and after assets are cached, otherwise
        // we will not load balances on initial balance query
      ).then(() => tokenListLoad.then(() => this.loadAccountBalances()))
    })
  }

  /**
   * Get all assets we're tracking, for both balances and prices. Only fungible
   * assets are currently supported.
   *
   * @returns An array of fungible smart contract assets.
   */
  async getAssetsToTrack(): Promise<SmartContractFungibleAsset[]> {
    return this.db.getAssetsToTrack()
  }

  /**
   * Begin tracking the price and any balance changes of a fungible network-
   * specific asset.
   *
   * @param asset The fungible asset to track.
   */
  async addAssetToTrack(asset: SmartContractFungibleAsset): Promise<void> {
    // TODO Track across all account/network pairs, not just on one network or
    // TODO account.
    await this.db.addAssetToTrack(asset)
  }

  /**
   * Adds/updates a custom asset, invalidates internal cache for asset network
   * @param asset The custom asset
   */
  async addOrUpdateCustomAsset(
    asset: SmartContractFungibleAsset
  ): Promise<void> {
    await this.db.addOrUpdateCustomAsset(asset)
    await this.cacheAssetsForNetwork(asset.homeNetwork)
  }

  /**
   * Retrieves the latest balance of the specified asset for the specified
   * account on the specified network.
   *
   * @param account The account that owns the given asset.
   * @param network The network on which the balance is being checked.
   * @param asset The asset whose balance is being checked.
   */
  async getLatestAccountBalance(
    account: string,
    network: NetworkInterface,
    asset: FungibleAsset
  ): Promise<AccountBalance | null> {
    return this.db.getLatestAccountBalance(account, network, asset)
  }

  /**
   * Retrieves cached assets data from internal cache
   * @returns An array of assets, including base assets that are "built in" to
   *          the codebase. Fiat currencies are not included.
   */
  getCachedAssets(network: NetworkInterface): AnyAsset[] {
    return this.cachedAssets[network.chainID] ?? []
  }

  /**
   * Caches to memory asset metadata from hard-coded base assets and configured token
   * lists.
   */
  async cacheAssetsForNetwork(network: NetworkInterface): Promise<void> {
    const customAssets = await this.db.getActiveCustomAssetsByNetworks([
      network,
    ])
    const tokenListPrefs =
      await this.preferenceService.getTokenListPreferences()
    const tokenLists = await this.db.getLatestTokenLists(tokenListPrefs.urls)

    this.cachedAssets[network.chainID] = mergeAssets<FungibleAsset>(
      [network.baseAsset],
      customAssets,
      networkAssetsFromLists(network, tokenLists)
    )
  }

  /**
   * Find the metadata for a known SmartContractFungibleAsset based on the
   * network and address.
   *
   * @param network - the home network of the asset
   * @param contractAddress - the address of the asset on its home network
   */
  getKnownSmartContractAsset(
    network: NetworkInterface,
    contractAddress: HexString
  ): SmartContractFungibleAsset | undefined {
    const knownAssets = this.getCachedAssets(network)
    const searchResult = knownAssets.find(
      (asset): asset is SmartContractFungibleAsset =>
        isSmartContractFungibleAsset(asset) &&
        asset.homeNetwork.baseAsset.name === network.baseAsset.name &&
        asset.contractAddress === contractAddress
    )

    return searchResult
  }

  /* *****************
   * PRIVATE METHODS *
   ******************* */

  private acceleratedTokenRefresh: {
    timeout: number | undefined
    assetLookups: {
      asset: SmartContractFungibleAsset
      addressOnNetwork: AddressOnNetwork
    }[]
  } = {
    timeout: undefined,
    assetLookups: [],
  }

  notifyEnrichedTransaction(
    enrichedEVMTransaction: EnrichedQuaiTransaction
  ): void {
    const network = getNetworkById(enrichedEVMTransaction?.chainId)

    if (!network)
      throw new Error("Failed find a network in notifyEnrichedTransaction")

    const jointAnnotations =
      typeof enrichedEVMTransaction.annotation === "undefined"
        ? []
        : [
            enrichedEVMTransaction.annotation,
            ...(enrichedEVMTransaction.annotation.subannotations ?? []),
          ]

    jointAnnotations.forEach(async (annotation) => {
      // Note asset transfers of smart contract assets to or from an
      // address we're tracking, and ensure we're tracking that asset +
      // that we do an accelerated balance check.
      if (
        typeof annotation !== "undefined" &&
        annotation.type === "asset-transfer" &&
        isSmartContractFungibleAsset(annotation.assetAmount.asset)
      ) {
        const { asset } = annotation.assetAmount
        const annotationAddressesOnNetwork = [
          annotation.sender.address,
          annotation.recipient.address,
        ].map((address) => ({
          address,
          network,
        }))

        const trackedAddresesOnNetworks =
          await this.chainService.filterTrackedAddressesOnNetworks(
            annotationAddressesOnNetwork
          )

        // An asset has baseline trust if we are already tracking the asset
        // (e.g. via a previously baseline-trusted interaction or via a token
        // list) OR the sender is a tracked address.
        const baselineTrustedAsset =
          typeof this.getKnownSmartContractAsset(
            network,
            asset.contractAddress
          ) !== "undefined" ||
          (await this.db.isTrackingAsset(asset)) ||
          (enrichedEVMTransaction.from &&
            (
              await this.chainService.filterTrackedAddressesOnNetworks([
                {
                  address: enrichedEVMTransaction.from,
                  network,
                },
              ])
            ).length > 0)

        if (baselineTrustedAsset) {
          const assetLookups = trackedAddresesOnNetworks.map(
            (addressOnNetwork) => ({
              asset,
              addressOnNetwork,
            })
          )

          this.acceleratedTokenRefresh.assetLookups.push(...assetLookups)
          this.acceleratedTokenRefresh.timeout ??= self.setTimeout(
            this.handleAcceleratedTokenRefresh.bind(this),
            ACCELERATED_TOKEN_REFRESH_TIMEOUT
          )
        }
      }
    })
  }

  private async handleAcceleratedTokenRefresh(): Promise<void> {
    try {
      const { assetLookups } = this.acceleratedTokenRefresh

      this.acceleratedTokenRefresh.timeout = undefined
      this.acceleratedTokenRefresh.assetLookups = []

      const lookupsByAddressOnNetwork = assetLookups.reduce<
        [AddressOnNetwork, SmartContractFungibleAsset[]][]
      >((lookups, { asset, addressOnNetwork: { address, network } }) => {
        const existingAddressOnNetworkIndex = lookups.findIndex(
          ([{ address: existingAddress, network: existingNetwork }]) =>
            sameQuaiAddress(address, existingAddress) &&
            sameNetwork(network, existingNetwork)
        )

        if (existingAddressOnNetworkIndex !== -1) {
          lookups[existingAddressOnNetworkIndex][1].push(asset)
        } else {
          lookups.push([{ address, network }, [asset]])
        }

        return lookups
      }, [])

      lookupsByAddressOnNetwork.forEach(([addressOnNetwork, assets]) => {
        this.retrieveTokenBalances(addressOnNetwork, assets)
      })
    } catch (error) {
      logger.error("Error during accelerated token refresh", error)
    }
  }

  private async connectChainServiceEvents(): Promise<void> {
    // listen for assetTransfers, and if we find them, track those tokens
    // TODO update for NFTs
    this.chainService.emitter.on(
      "assetTransfers",
      async ({ addressNetwork, assetTransfers }) => {
        assetTransfers.forEach((transfer) => {
          const fungibleAsset = transfer.assetAmount.asset
          if (isSmartContractFungibleAsset(fungibleAsset)) {
            this.addTokenToTrackByContract(
              addressNetwork.network,
              fungibleAsset.contractAddress,
              { discoveryTxHash: transfer.txHash }
            )
          }
        })
      }
    )

    this.chainService.emitter.on(
      "newAccountToTrack",
      async ({ addressOnNetwork }) => {
        // whenever a new account is added, get token balances from Alchemy's
        // default list and add any non-zero tokens to the tracking list
        const balances = await this.retrieveTokenBalances(addressOnNetwork)

        // Every asset we have that hasn't already been balance checked and is
        // on the currently selected network should be checked once.
        //
        // Note that we'll want to move this to a queuing system that can be
        // easily rate-limited eventually.
        const checkedContractAddresses = new Set(
          balances.map(
            ({ smartContract: { contractAddress } }) => contractAddress
          )
        )
        const cachedAssets = this.getCachedAssets(addressOnNetwork.network)

        const otherActiveAssets = cachedAssets
          .filter(isSmartContractFungibleAsset)
          .filter(
            (a) =>
              a.homeNetwork.chainID === addressOnNetwork.network.chainID &&
              !checkedContractAddresses.has(a.contractAddress)
          )

        await this.retrieveTokenBalances(addressOnNetwork, otherActiveAssets)
      }
    )

    this.transactionService.emitter.on(
      "updateQuaiTransaction",
      async ({ transaction, forAccounts }) => {
        const transactionNetwork = getNetworkById(transaction?.chainId)

        if (!transactionNetwork)
          throw new Error("Failed find network for transaction")
        if (
          "status" in transaction &&
          transaction.status === 1 &&
          transaction?.blockNumber &&
          transaction.blockNumber >
            (await this.blockService.getBlockHeight(transactionNetwork)) -
              FAST_TOKEN_REFRESH_BLOCK_RANGE
        ) {
          this.scheduledTokenRefresh = true
        }
        if (
          "status" in transaction &&
          (transaction.status === 1 || transaction.status === 0)
        ) {
          forAccounts.forEach((accountAddress) => {
            this.chainService.getLatestBaseAccountBalance({
              address: accountAddress,
              network: transactionNetwork,
            })
          })
        }
      }
    )
  }

  /**
   * Retrieve token balances for a particular account on a particular network,
   * saving the resulting balances and adding any asset with a non-zero balance
   * to the list of assets to track.
   *
   * @param addressNetwork
   * @param smartContractAssets
   */
  async retrieveTokenBalances(
    addressNetwork: AddressOnNetwork,
    smartContractAssets?: SmartContractFungibleAsset[]
  ): Promise<SmartContractAmount[]> {
    const filteredSmartContractAssets = (smartContractAssets ?? []).filter(
      ({ contractAddress }) =>
        getExtendedZoneForAddress(contractAddress, false) ===
        getExtendedZoneForAddress(addressNetwork.address, false)
    )

    const balances = await this.chainService.assetData.getTokenBalances(
      addressNetwork,
      filteredSmartContractAssets?.map(({ contractAddress }) =>
        getExtendedZoneForAddress(contractAddress, false) ===
        getExtendedZoneForAddress(addressNetwork.address, false)
          ? contractAddress
          : ""
      )
    )

    const listedAssetByAddress = (smartContractAssets ?? []).reduce<{
      [contractAddress: string]: SmartContractFungibleAsset
    }>((acc, asset) => {
      acc[asset.contractAddress] = asset
      return acc
    }, {})

    // look up all assets and set balances
    const unfilteredAccountBalances = await Promise.allSettled(
      balances.map(async ({ smartContract: { contractAddress }, amount }) => {
        const knownAsset =
          listedAssetByAddress[contractAddress] ??
          this.getKnownSmartContractAsset(
            addressNetwork.network,
            contractAddress
          )

        if (amount > 0) {
          if (knownAsset) {
            await this.addAssetToTrack(knownAsset)
          } else {
            await this.addTokenToTrackByContract(
              addressNetwork.network,
              contractAddress
            )
          }
        }

        if (knownAsset) {
          const accountBalance = {
            ...addressNetwork,
            assetAmount: {
              asset: knownAsset,
              amount,
            },
            retrievedAt: Date.now(),
            dataSource: "local",
          } as const

          return accountBalance
        }

        return undefined
      })
    )

    const accountBalances = unfilteredAccountBalances.reduce<AccountBalance[]>(
      (acc, current) => {
        if (current.status === "fulfilled" && current.value)
          return [...acc, current.value]

        return acc
      },
      []
    )

    await this.db.addBalances(accountBalances)
    this.emitter.emit("accountsWithBalances", {
      balances: accountBalances,
      addressOnNetwork: addressNetwork,
    })

    return balances
  }

  async updateAssetMetadata(
    asset: SmartContractFungibleAsset,
    metadata: AnyAssetMetadata
  ): Promise<void> {
    const updatedAsset: SmartContractFungibleAsset = {
      ...asset,
      metadata: {
        ...asset.metadata,
        ...metadata,
      },
    }

    await this.db.addOrUpdateCustomAsset(updatedAsset)
    await this.cacheAssetsForNetwork(asset.homeNetwork)
    this.emitter.emit("refreshAsset", updatedAsset)
  }

  async hideAsset(asset: SmartContractFungibleAsset): Promise<void> {
    const metadata = {
      ...asset.metadata,
      removed: true,
    }

    // The updated metadata should only be sent to the db
    await this.db.addOrUpdateCustomAsset({ ...asset, metadata })
    await this.cacheAssetsForNetwork(asset.homeNetwork)
    this.emitter.emit("removeAssetData", asset)
  }

  async importCustomToken(asset: SmartContractFungibleAsset): Promise<boolean> {
    asset.contractAddress = getAddress(asset.contractAddress)
    asset.decimals = Number(asset.decimals)

    const customAsset = {
      ...asset,
      metadata: {
        ...(asset.metadata ?? {}),
        // Manually imported tokens are verified
        verified: true,
      },
    }

    await this.addTokenToTrackByContract(
      asset.homeNetwork,
      asset.contractAddress,
      customAsset.metadata
    )

    try {
      const addresses = await this.chainService.getTrackedAddressesOnNetwork(
        asset.homeNetwork
      )
      await Promise.allSettled(
        addresses.map(async (addressNetwork) => {
          await this.retrieveTokenBalances(addressNetwork, [customAsset])
        })
      )
      return true
    } catch (error) {
      logger.error(
        "Error retrieving new custom token balances for ",
        asset,
        ": ",
        error
      )
      return false
    }
  }

  /**
   * Add an asset to track to a particular account and network, specified by the
   * contract address and optional decimals.
   *
   * If the asset has already been cached, use that. Otherwise, infer asset
   * details from the contract and outside services.
   *
   * @param network the account and network on which this asset should be tracked
   * @param contractAddress the address of the token contract on this network
   * @param metadata optionally include the number of decimals tracked by a
   *        fungible asset. Useful in case this asset isn't found in existing metadata.
   */
  async addTokenToTrackByContract(
    network: NetworkInterface,
    contractAddress: string,
    metadata: { discoveryTxHash?: HexString; verified?: boolean } = {}
  ): Promise<SmartContractFungibleAsset | undefined> {
    const knownAsset = this.getKnownSmartContractAsset(network, contractAddress)
    if (knownAsset) {
      await this.addAssetToTrack(knownAsset)
      return knownAsset
    }

    // Attempt to retrieve the custom asset from the database
    // If it does not exist in the database, fetch its metadata using the provider
    const customAsset: CustomAsset | undefined =
      (await this.db.getCustomAssetByAddressAndNetwork(
        network,
        contractAddress
      )) ||
      (await this.chainService.assetData.getTokenMetadata({
        contractAddress,
        homeNetwork: network,
      }))
    if (!customAsset) return undefined

    customAsset.decimals = Number(customAsset.decimals)

    const isRemoved = customAsset.metadata?.removed ?? false
    const { verified } = metadata
    const shouldAddRemovedAssetAgain = isRemoved && verified

    // If the asset has not been removed, or if it has been removed and should be re-added
    if (!isRemoved || shouldAddRemovedAssetAgain) {
      if (Object.keys(metadata).length) {
        customAsset.metadata ??= {}
        Object.assign(customAsset.metadata, metadata)

        if (isRemoved) customAsset.metadata.removed = false
      }

      await this.addOrUpdateCustomAsset(customAsset)
      await this.emitter.emit("refreshAsset", customAsset)
      await this.addAssetToTrack(customAsset)
    }

    return customAsset
  }

  private async fetchAndCacheTokenLists(): Promise<void> {
    const tokenListPrefs =
      await this.preferenceService.getTokenListPreferences()

    // load each token list in preferences
    await Promise.allSettled(
      tokenListPrefs.urls.map(async (url) => {
        const cachedList = await this.db.getLatestTokenList(url)
        if (!cachedList) {
          try {
            const newListRef = await fetchAndValidateTokenList(url)

            await this.db.saveTokenList(url, newListRef.tokenList)
          } catch (err) {
            logger.error(
              `Error fetching, validating, and saving token list ${url}`
            )
          }
        }
      })
    )

    // Cache assets across all supported networks even if a network
    // may be inactive.
    this.chainService.supportedNetworks.forEach(async (network) => {
      await this.cacheAssetsForNetwork(network)
      this.emitter.emit("assets", this.getCachedAssets(network))
    })

    // TODO if tokenListPrefs.autoUpdate is true, pull the latest and update if
    // the version has gone up
  }

  private async handleBalanceRefresh(): Promise<void> {
    if (this.scheduledTokenRefresh) {
      await this.handleBalanceAlarm()
      this.scheduledTokenRefresh = false
    }
  }

  private async loadAccountBalances(onlyActiveAccounts = false): Promise<void> {
    // TODO doesn't support multi-network assets
    // like USDC or CREATE2-based contracts on L1/L2
    const accounts = await this.chainService.getAccountsToTrack(
      onlyActiveAccounts
    )

    await Promise.allSettled(
      accounts.map(async (addressOnNetwork) => {
        const { network } = addressOnNetwork

        const prevShard = globalThis.main.SelectedShard
        if (isQuaiHandle(network)) {
          const shard = getExtendedZoneForAddress(addressOnNetwork.address)
          globalThis.main.SetShard(shard)
        }

        const loadBaseAccountBalance =
          this.chainService.getLatestBaseAccountBalance(addressOnNetwork)

        /**
         * We try checking balances for every asset
         * we've seen in the network.
         */
        const assetsToCheck =
          // This doesn't pass assetsToTrack stored in the db as
          // it assumes they've already been cached
          this.getCachedAssets(network).filter(isSmartContractFungibleAsset)

        const loadTokenBalances = this.retrieveTokenBalances(
          addressOnNetwork,
          assetsToCheck
        )
        globalThis.main.SetShard(prevShard)
        return Promise.all([loadBaseAccountBalance, loadTokenBalances])
      })
    )
  }

  private async handleBalanceAlarm(): Promise<void> {
    await this.fetchAndCacheTokenLists().then(() =>
      this.loadAccountBalances(true)
    )
  }

  async persistQiCoinbaseAddress(address: QiCoinbaseAddress): Promise<void> {
    await this.db.addQiCoinbaseAddress(address)
  }

  async getQiCoinbaseAddresses(): Promise<QiCoinbaseAddress[]> {
    return this.db.getQiCoinbaseAddresses()
  }
}
