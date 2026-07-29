import {
  PermissionRequest,
  isEIP1193Error,
  EIP1193ErrorPayload,
  RPCRequest,
} from "@pelagus-provider/provider-bridge-shared"
import { AddEthereumChainParameter } from "../internal-quai-provider"
import { sameQuaiAddress } from "../../lib/utils"
import { HexString } from "../../types"

export type PermissionMap = {
  evm: {
    [chainID: string]: {
      [address: string]: {
        [origin: string]: PermissionRequest
      }
    }
  }
}

export const keyPermissionsByChainIdAddressOrigin = (
  permissions: PermissionRequest[],
  permissionMap?: PermissionMap
): PermissionMap => {
  const map = permissionMap ?? { evm: {} }
  permissions.forEach((permission) => {
    map.evm[permission.chainID] ??= {}
    map.evm[permission.chainID][permission.accountAddress] ??= {}
    map.evm[permission.chainID][permission.accountAddress][permission.origin] =
      permission
  })
  return map
}

export function parsedRPCErrorResponse(error: { body: string }):
  | {
      code: number
      message: string
    }
  | undefined {
  try {
    const parsedError = JSON.parse(error.body).error
    return {
      code: typeof parsedError.code === "number" ? parsedError.code : -32603,
      message:
        "message" in parsedError && parsedError.message
          ? parsedError.message[0].toUpperCase() + parsedError.message.slice(1)
          : "Internal JSON-RPC error.",
    }
  } catch (err) {
    return undefined
  }
}

export function handleRPCErrorResponse(error: unknown): unknown {
  let response
  if (typeof error === "object" && error !== null) {
    if (isEIP1193Error(error)) {
      return error
    }

    /**
     * Get error per the RPC method’s specification
     */
    if ("eip1193Error" in error) {
      const { eip1193Error } = error as {
        eip1193Error: EIP1193ErrorPayload
      }
      if (isEIP1193Error(eip1193Error)) {
        response = eip1193Error
      }
      /**
       * In the case of a non-matching error message, the error is returned without being nested in an object.
       * This is due to the error handling implementation.
       * Check the code for more details https://github.com/ethers-io/ethers.js/blob/master/packages/providers/src.ts/json-rpc-provider.ts#L96:L130
       */
    } else if ("body" in error) {
      response = parsedRPCErrorResponse(error as { body: string })
    } else if ("error" in error) {
      const nestedError = (error as { error: unknown }).error
      if (isEIP1193Error(nestedError)) {
        response = nestedError
      } else if (
        typeof nestedError === "object" &&
        nestedError !== null &&
        "body" in nestedError
      ) {
        response = parsedRPCErrorResponse(nestedError as { body: string })
      }
    }
  }

  if (response) return response

  return {
    code: -32603,
    message:
      error instanceof Error && error.message
        ? error.message
        : "Internal JSON-RPC error.",
  }
}

// Let's start with all required and work backwards
export type ValidatedAddEthereumChainParameter = {
  chainId: string
  blockExplorerUrl: string
  chainName: string
  iconUrl?: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
}

export const validateAddEthereumChainParameter = ({
  chainId,
  chainName,
  blockExplorerUrls,
  iconUrls,
  nativeCurrency,
  rpcUrls,
}: AddEthereumChainParameter): ValidatedAddEthereumChainParameter => {
  // @TODO Use AJV
  if (
    !chainId ||
    !chainName ||
    !nativeCurrency ||
    !blockExplorerUrls ||
    !blockExplorerUrls.length ||
    !rpcUrls ||
    !rpcUrls.length
  ) {
    throw new Error("Missing Chain Property")
  }

  if (
    !nativeCurrency.decimals ||
    !nativeCurrency.name ||
    !nativeCurrency.symbol
  ) {
    throw new Error("Missing Currency Property")
  }

  return {
    chainId: chainId.startsWith("0x") ? String(parseInt(chainId, 16)) : chainId,
    chainName,
    nativeCurrency,
    blockExplorerUrl: blockExplorerUrls[0],
    iconUrl: iconUrls && iconUrls[0],
    rpcUrls,
  }
}

/**
 * Try to fix request params for dapps that are sending requests with flipped params order.
 * For now, it only affects eth_call and personal_sign as message and address order is sometimes reversed.
 *
 * @returns JSON RPC request's params - unchanged or flipped
 */
export function parseRPCRequestParams(
  enablingPermission: PermissionRequest,
  method: string,
  params: RPCRequest["params"]
): RPCRequest["params"] {
  switch (method) {
    case "quai_sign":
    case "eth_sign":
      return sameQuaiAddress(
        params[0] as HexString,
        enablingPermission.accountAddress
      )
        ? params
        : [params[1], params[0]]

    case "personal_sign":
      return sameQuaiAddress(
        params[1] as HexString,
        enablingPermission.accountAddress
      )
        ? params
        : [params[1], params[0], params[2]]

    case "qi_signAll":
      return sameQuaiAddress(
        params[1] as HexString,
        enablingPermission.accountAddress
      )
        ? params
        : [params[0], params[1], params[2]]

    default:
      return params
  }
}
