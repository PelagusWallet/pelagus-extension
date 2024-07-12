import { JsonRpcProvider } from "quais"
import {
  AssetTransfer,
  SmartContractAmount,
  SmartContractFungibleAsset,
} from "../../../assets"
import { AddressOnNetwork } from "../../../accounts"
import { HexString } from "../../../types"
import logger from "../../../lib/logger"
import { SmartContract } from "../../../networks"
import {
  getBalance,
  getMetadata as getERC20Metadata,
  getTokenBalances,
} from "../../../lib/erc20"
import { getExtendedZoneForAddress } from "./index"

/**
 * AssetDataHelper is a wrapper for asset-related functionality like token
 * balance and transfer lookup that may use several different strategies to
 * attempt data lookup depending on the underlying network and data provider.
 * It exposes a uniform interface to fetch various aspects of asset information
 * from the chain, and manages underlying provider differences and
 * optimizations.
 */
export default class AssetDataHelper {
  constructor(private providerTracker: JsonRpcProvider | null) {}

  async getTokenBalance(
    addressOnNetwork: AddressOnNetwork,
    smartContractAddress: HexString
  ): Promise<SmartContractAmount> {
    const prevShard = globalThis.main.GetShard()
    globalThis.main.SetShard(getExtendedZoneForAddress(smartContractAddress))
    const provider = this.providerTracker

    if (!provider) {
      throw logger.buildError(
        "Could not find a provider for network",
        addressOnNetwork.network
      )
    }

    const balance = await getBalance(
      provider,
      smartContractAddress,
      addressOnNetwork.address
    )
    globalThis.main.SetShard(prevShard)
    return {
      amount: balance,
      smartContract: {
        contractAddress: smartContractAddress,
        homeNetwork: addressOnNetwork.network,
      },
    }
  }

  async getTokenBalances(
    addressOnNetwork: AddressOnNetwork,
    smartContractAddresses?: HexString[]
  ): Promise<SmartContractAmount[]> {
    const prevShard = globalThis.main.GetShard()
    globalThis.main.SetShard(
      getExtendedZoneForAddress(addressOnNetwork.address)
    )
    const provider = this.providerTracker

    if (!provider) throw new Error("Failed get provider for network")
    globalThis.main.SetShard(prevShard)
    if (typeof provider === "undefined") return []

    try {
      return await getTokenBalances(
        addressOnNetwork,
        smartContractAddresses || [],
        provider
      )
    } catch (error) {
      logger.debug(
        "Problem resolving asset balances; network may not support it.",
        error
      )
    }

    return []
  }

  /**
   * Retrieves metadata for a custom asset (e.g. when adding Custom Asset),
   * using the provider associated with the QUAI network to obtain the token's metadata.
   */
  async getTokenMetadata(
    tokenSmartContract: SmartContract
  ): Promise<SmartContractFungibleAsset | undefined> {
    const provider = this.providerTracker
    if (!provider) throw new Error("Failed get provider for network")

    return getERC20Metadata(provider, tokenSmartContract)
  }

  // eslint-disable-next-line class-methods-use-this
  async getAssetTransfers(): Promise<AssetTransfer[]> {
    return []
  }
}
