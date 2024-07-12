import { HexString, UNIXTime } from "../../types"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import BaseService from "../base"
import ChainService from "../chain"
import logger from "../../lib/logger"
import { AddressOnNetwork, NameOnNetwork } from "../../accounts"
import { SECOND } from "../../constants"
import { NameResolver } from "./name-resolver"
import { NameResolverSystem, addressBookResolverFor } from "./resolvers"
import PreferenceService from "../preferences"
import { isFulfilledPromise } from "../../lib/utils/type-guards"

export { NameResolverSystem }

export type ResolvedAddressRecord = {
  from: NameOnNetwork
  resolved: {
    addressOnNetwork: AddressOnNetwork
  }
  system: NameResolverSystem
}

export type ResolvedNameRecord = {
  from: {
    addressOnNetwork: AddressOnNetwork
  }
  resolved: {
    nameOnNetwork: NameOnNetwork
    expiresAt: UNIXTime
  }
  system: NameResolverSystem
}

type Events = ServiceLifecycleEvents & {
  resolvedAddress: ResolvedAddressRecord
  resolvedName: ResolvedNameRecord
}

// A minimum record expiry that avoids infinite resolution loops.
const MINIMUM_RECORD_EXPIRY = 10 * SECOND

/**
 The NameService is responsible for resolving human-readable names into addresses and other metadata across multiple networks, caching where ppropriate.
*/
export default class NameService extends BaseService<Events> {
  private resolvers: NameResolver<NameResolverSystem>[] = []

  /**
   * Cached resolution for name records, by network family followed by whatever
   * discrimant might be used within a network family between networks.
   */
  private cachedResolvedNames: {
    [chainID: string]: {
      [address: HexString]: ResolvedNameRecord | undefined
    }
  } = {}

  /**
   * Create a new NameService. The service isn't initialized until
   * startService() is called and resolved.
   *
   * @param chainService - Required for chain interactions.
   * @returns A new, initializing ChainService
   */
  static create: ServiceCreatorFunction<
    Events,
    NameService,
    [Promise<ChainService>, Promise<PreferenceService>]
  > = async (chainService, preferenceService) => {
    return new this(await chainService, await preferenceService)
  }

  private constructor(
    private chainService: ChainService,
    preferenceService: PreferenceService
  ) {
    super({})
    this.resolvers = [addressBookResolverFor(preferenceService)]

    preferenceService.emitter.on(
      "addressBookEntryModified",
      async ({ network, address }) => {
        this.clearNameCacheEntry(network.chainID, address)
        await this.lookUpName({ network, address })
      }
    )

    chainService.emitter.on(
      "newAccountToTrack",
      async ({ addressOnNetwork }) => {
        try {
          await this.lookUpName(addressOnNetwork)
        } catch (error) {
          logger.error(
            "Error fetching name for address",
            addressOnNetwork,
            error
          )
        }
      }
    )
  }

  async lookUpEthereumAddress(
    nameOnNetwork: NameOnNetwork
  ): Promise<ResolvedAddressRecord | undefined> {
    const workingResolvers = this.resolvers.filter((resolver) =>
      resolver.canAttemptAddressResolution(nameOnNetwork)
    )

    const firstMatchingResolution = (
      await Promise.allSettled(
        workingResolvers.map(async (resolver) => ({
          type: resolver.type,
          resolved: await resolver.lookUpAddressForName(nameOnNetwork),
        }))
      )
    )
      .filter(isFulfilledPromise)
      .find(({ value: { resolved } }) => resolved !== undefined)?.value

    if (
      firstMatchingResolution === undefined ||
      firstMatchingResolution.resolved === undefined
    ) {
      return undefined
    }

    const { type: resolverType, resolved: addressOnNetwork } =
      firstMatchingResolution

    const resolvedRecord = {
      from: nameOnNetwork,
      resolved: { addressOnNetwork },
      system: resolverType,
    }
    this.emitter.emit("resolvedAddress", resolvedRecord)

    return resolvedRecord
  }

  async lookUpName(
    addressOnNetwork: AddressOnNetwork,
    checkCache = true
  ): Promise<ResolvedNameRecord | undefined> {
    const { address, network } = addressOnNetwork

    if (!this.cachedResolvedNames[network.chainID]) {
      this.cachedResolvedNames[network.chainID] = {}
    }

    const cachedResolvedNameRecord =
      this.cachedResolvedNames?.[network.chainID]?.[address]

    if (checkCache && cachedResolvedNameRecord) {
      const {
        resolved: { expiresAt },
      } = cachedResolvedNameRecord

      if (expiresAt >= Date.now()) {
        return cachedResolvedNameRecord
      }
    }

    const workingResolvers = this.resolvers.filter((resolver) =>
      resolver.canAttemptNameResolution({ address, network })
    )
    const localResolvers = [...workingResolvers].filter(
      (resolver) => resolver.type === "tally-address-book"
    )
    const remoteResolvers = [...workingResolvers].filter(
      (resolver) => resolver.type !== "tally-address-book"
    )

    let firstMatchingResolution = (
      await Promise.allSettled(
        localResolvers.map(async (resolver) => ({
          type: resolver.type,
          resolved: await resolver.lookUpNameForAddress({ address, network }),
        }))
      )
    )
      .filter(isFulfilledPromise)
      .find(({ value: { resolved } }) => resolved !== undefined)?.value

    if (!firstMatchingResolution) {
      firstMatchingResolution = (
        await Promise.allSettled(
          remoteResolvers.map(async (resolver) => ({
            type: resolver.type,
            resolved: await resolver.lookUpNameForAddress({ address, network }),
          }))
        )
      )
        .filter(isFulfilledPromise)
        .find(({ value: { resolved } }) => resolved !== undefined)?.value
    }

    if (
      firstMatchingResolution === undefined ||
      firstMatchingResolution.resolved === undefined
    )
      return undefined

    const { type: resolverType, resolved: nameOnNetwork } =
      firstMatchingResolution

    const nameRecord = {
      from: { addressOnNetwork: { address, network } },
      resolved: {
        nameOnNetwork,
        // TODO Read this from the name service; for now, this avoids infinite
        // TODO resolution loops.
        expiresAt: Date.now() + MINIMUM_RECORD_EXPIRY,
      },
      system: resolverType,
    } as const

    const cachedNameOnNetwork = cachedResolvedNameRecord?.resolved.nameOnNetwork

    this.cachedResolvedNames[network.chainID][address] = nameRecord

    if (cachedNameOnNetwork?.name !== nameOnNetwork.name) {
      this.emitter.emit("resolvedName", nameRecord)
    }

    return nameRecord
  }

  clearNameCacheEntry(chainId: string, address: HexString): void {
    if (this.cachedResolvedNames[chainId]?.[address] !== undefined) {
      delete this.cachedResolvedNames[chainId][address]
    }
  }

  removeAccount(address: HexString): void {
    const chainIds = Object.keys(this.cachedResolvedNames.EVM)
    chainIds.forEach((chainId) => {
      this.clearNameCacheEntry(chainId, address)
    })
  }

  removeActivities(address: HexString): void {
    const chainIds = Object.keys(this.cachedResolvedNames.EVM)
    chainIds.forEach((chainId) => {
      this.clearNameCacheEntry(chainId, address)
    })
  }
}
