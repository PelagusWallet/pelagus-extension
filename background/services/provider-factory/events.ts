import { ServiceLifecycleEvents } from "../types"

export type LocalNodeNetworkStatusEventTypes = {
  status: boolean
  localNodeNetworkChainId: string
}

export default interface ProviderFactoryEvents extends ServiceLifecycleEvents {
  localNodeNetworkStatus: LocalNodeNetworkStatusEventTypes
}
