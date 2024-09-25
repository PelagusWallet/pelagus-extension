import Dexie from "dexie"

import { PELAGUS_INTERNAL_ORIGIN } from "./constants"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { QuaiGoldenAgeTestnet } from "../../constants/networks/networks"

type NetworkForOrigin = {
  origin: string
  network: NetworkInterface
}

export class InternalQuaiProviderDatabase extends Dexie {
  private currentNetwork!: Dexie.Table<NetworkForOrigin, string>

  constructor() {
    super("pelagus/internal-quai-provider")
    this.version(1).stores({
      currentNetwork: "&origin,network.chainID",
    })

    this.on("populate", (tx) => {
      return tx.db
        .table("currentNetwork")
        .add({ origin: PELAGUS_INTERNAL_ORIGIN, network: QuaiGoldenAgeTestnet })
    })
  }

  async setCurrentChainIdForOrigin(
    origin: string,
    network: NetworkInterface
  ): Promise<string | undefined> {
    return this.currentNetwork.put({ origin, network })
  }

  async getCurrentNetworkForOrigin(
    origin: string
  ): Promise<NetworkInterface | undefined> {
    const currentNetwork = await this.currentNetwork.get({ origin })
    return currentNetwork?.network
  }

  async removeStoredPreferencesForChain(chainID: string): Promise<void> {
    await this.currentNetwork.where({ "network.chainID": chainID }).delete()
  }
}

export async function initializeInternalQuaiDatabase(): Promise<InternalQuaiProviderDatabase> {
  return new InternalQuaiProviderDatabase()
}
