export const EXTERNAL_PORT_NAME = "pelagus-external"
export const PORT_RECONNECT_TIMEOUT_IN_MILLISECONDS = 1000
export const PORT_HEALTH_CHECK_INTERVAL_IN_MILLISECONDS = 5000
export const PELAGUS_INTERNAL_COMMUNICATION_ID = "pelagus-internal"

export const PELAGUS_WINDOW_PROVIDER_CHAIN_ID = "0x9"
export const PELAGUS_WINDOW_PROVIDER_LABEL = "Pelagus"
export const PELAGUS_WINDOW_PROVIDER_VERSION = 2
export const PELAGUS_WINDOW_PROVIDER_INJECTED_NAMESPACE = "pelagus"
export const PELAGUS_WINDOW_PROVIDER_ICON_URL =
  "https://pelaguswallet.io/docs/img/PelagusLogoSquare.png" // TODO icon for pelagus provider
export const PELAGUS_WINDOW_PROVIDER_IDENTITY_FLAG = "isPelagus"

export const WINDOW_PROVIDER_TARGET = "pelagus-window-provider"
export const PROVIDER_BRIDGE_TARGET = "pelagus-provider-bridge"

export const PELAGUS_METHODS_PREFIX = "pelagus_"
export const PELAGUS_GET_CONFIG_METHOD = `${PELAGUS_METHODS_PREFIX}getConfig`
export const PELAGUS_ACCOUNT_CHANGED_METHOD = `${PELAGUS_METHODS_PREFIX}accountChanged`
export const PELAGUS_HEALTH_CHECK_METHOD = `${PELAGUS_METHODS_PREFIX}healthCheck`
export const PELAGUS_QNS_RESOLVE_NAME_METHOD = `${PELAGUS_METHODS_PREFIX}qnsResolveName`
export const PELAGUS_QNS_GET_MODULE_METHOD = `${PELAGUS_METHODS_PREFIX}qnsGetModule`
export const PELAGUS_QNS_OPEN_METHOD = `${PELAGUS_METHODS_PREFIX}qnsOpen`
