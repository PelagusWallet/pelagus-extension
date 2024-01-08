import { SignClientTypes } from "@walletconnect/types"
import {
  EIP1193Error,
  EIP1193_ERROR_CODES,
} from "@tallyho/provider-bridge-shared"
import { formatErrorMessage } from "./error"
import {
  TranslatedRequestParams,
  JsonRpcError,
  JsonRpcResult,
  ErrorResponse,
} from "./types"

function formatJsonRpcResult<T = unknown>(
  id: number,
  result: T
): JsonRpcResult<T> {
  return {
    id,
    jsonrpc: "2.0",
    result,
  }
}

function formatJsonRpcError(
  id: number,
  error?: string | ErrorResponse
): JsonRpcError {
  return {
    id,
    jsonrpc: "2.0",
    error: formatErrorMessage(error),
  }
}

export function approveEIP155Request(
  request: TranslatedRequestParams,
  signedMessage: string
): JsonRpcResult<unknown> {
  const { id, method } = request

  switch (method) {
    case "quai_sign":
    case "personal_sign":
    case "quai_signTransaction":
    case "quai_sendTransaction":
    case "eth_sign":
    case "eth_sendTransaction":
    case "eth_signTransaction":
      return formatJsonRpcResult(id, signedMessage)

    default:
      throw new Error("UNKNOWN_JSONRPC_METHOD")
  }
}

export function rejectEIP155Request(
  request: TranslatedRequestParams
): JsonRpcError {
  const { id } = request

  return formatJsonRpcError(id, "JSONRPC_REQUEST_METHOD_REJECTED")
}

export function processRequestParams(
  event: SignClientTypes.EventArguments["session_request"]
): TranslatedRequestParams {
  // TODO: figure out if this method is needed
  const { id, params: eventParams, topic } = event
  // TODO: handle chain id
  const { request } = eventParams

  switch (request.method) {
    case "quai_sign":
    case "personal_sign":
    case "quai_sendTransaction":
    case "quai_signTransaction":
    case "eth_sign":
    case "eth_sendTransaction":
    case "eth_signTransaction":
      return {
        id,
        topic,
        method: request.method,
        params: request.params,
      }
    default:
      throw new EIP1193Error(EIP1193_ERROR_CODES.unsupportedMethod)
  }
}
