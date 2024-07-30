import { ServiceLifecycleEvents } from "../types"

export type LocalNodeNetworkStatusEventTypes = {
  isDisabled: boolean
  localNodeNetworkChainId: string
}

export default interface ProviderFactoryEvents extends ServiceLifecycleEvents {
  localNodeNetworkStatus: LocalNodeNetworkStatusEventTypes
}
