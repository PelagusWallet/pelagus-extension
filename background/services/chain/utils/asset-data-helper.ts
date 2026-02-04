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
    const provider = globalThis.main.chainService.jsonRpcProvider

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
    // Switch to the shard of the first token address if provided; otherwise, fallback to address shard
    const first = (smartContractAddresses ?? []).find((t) => !!t)
    const targetShard = first
      ? getExtendedZoneForAddress(first)
      : getExtendedZoneForAddress(addressOnNetwork.address)
    globalThis.main.SetShard(targetShard)
    const provider = globalThis.main.chainService.jsonRpcProvider

    if (!provider) throw new Error("Failed get provider for network")
    // Keep provider bound to targetShard for the duration of the call

    try {
      const result = await getTokenBalances(
        addressOnNetwork,
        smartContractAddresses || [],
        provider
      )
      return result
    } catch (error: any) {
      logger.debug(
        `Problem resolving asset balances via multicall; attempting per-token fallback: ${
          error?.message || error
        }`
      )
      // Fallback: query each token individually
      if ((smartContractAddresses?.length ?? 0) > 0) {
        const results: SmartContractAmount[] = []
        for (const token of smartContractAddresses!) {
          try {
            const single = await this.getTokenBalance(addressOnNetwork, token)
            results.push(single)
          } catch (innerErr) {
            // ignore individual failures
          }
        }
        if (results.length > 0) return results
      }
    }
    finally {
      // Restore previous shard context
      globalThis.main.SetShard(prevShard)
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
    const provider = globalThis.main.chainService.jsonRpcProvider
    if (!provider) throw new Error("Failed get provider for network")

    return getERC20Metadata(provider, tokenSmartContract)
  }

  // eslint-disable-next-line class-methods-use-this
  async getAssetTransfers(): Promise<AssetTransfer[]> {
    return []
  }
}
