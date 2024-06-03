import {
  WindowResponseEvent,
  PortResponseEvent,
  PelagusConfigPayload,
  PelagusInternalCommunication,
  PelagusAccountPayload,
  PortHealthResponseEvent,
} from "./types"
import {
  PELAGUS_ACCOUNT_CHANGED_METHOD,
  PELAGUS_GET_CONFIG_METHOD,
  PELAGUS_HEALTH_CHECK_METHOD,
  PELAGUS_INTERNAL_COMMUNICATION_ID,
} from "./constants"

export function getType(arg: unknown): string {
  return Object.prototype.toString.call(arg).slice("[object ".length, -1)
}

export function isObject(
  arg: unknown
): arg is Record<string | number | symbol, unknown> {
  return getType(arg) === "Object"
}

export function isArray(arg: unknown): arg is Array<unknown> {
  return Array.isArray(arg)
}

export function isUndefined(arg: unknown): arg is undefined {
  return typeof arg === "undefined"
}

export function isString(arg: unknown): arg is string {
  return getType(arg) === "String"
}

export function isNumber(arg: unknown): arg is number {
  return getType(arg) === "Number"
}

export function isMessageEvent(arg: unknown): arg is MessageEvent {
  return arg instanceof MessageEvent
}

export function isWindowResponseEvent(
  arg: unknown
): arg is WindowResponseEvent {
  return (
    isMessageEvent(arg) &&
    isString(arg.origin) &&
    !isUndefined(arg.source) &&
    isObject(arg.data) &&
    isString(arg.data.id) &&
    isString(arg.data.target) &&
    !isUndefined(arg.data.result)
  )
}

export function isPortResponseEvent(arg: unknown): arg is PortResponseEvent {
  return isObject(arg) && isString(arg.id) && !isUndefined(arg.result)
}

export const AllowedQueryParamPage = {
  signTransaction: "/sign-transaction",
  addNewChain: "/add-evm-chain",
  dappPermission: "/dapp-permission",
  signData: "/sign-data",
  personalSignData: "/personal-sign",
} as const

export type AllowedQueryParamPageType =
  typeof AllowedQueryParamPage[keyof typeof AllowedQueryParamPage]

export function isAllowedQueryParamPage(
  url: unknown
): url is AllowedQueryParamPageType {
  return Object.values<unknown>(AllowedQueryParamPage).includes(url)
}

export function isPelagusPortHealthCheck(
  arg: unknown
): arg is PortHealthResponseEvent {
  return isObject(arg) && arg.method === PELAGUS_HEALTH_CHECK_METHOD
}

export function isPelagusInternalCommunication(
  arg: unknown
): arg is PelagusInternalCommunication {
  return isObject(arg) && arg.id === PELAGUS_INTERNAL_COMMUNICATION_ID
}

export function isPelagusConfigPayload(
  arg: unknown
): arg is PelagusConfigPayload {
  return isObject(arg) && arg.method === PELAGUS_GET_CONFIG_METHOD
}

export function isPelagusAccountPayload(
  arg: unknown
): arg is PelagusAccountPayload {
  return (
    isObject(arg) &&
    arg.method === PELAGUS_ACCOUNT_CHANGED_METHOD &&
    isArray(arg.address)
  )
}
