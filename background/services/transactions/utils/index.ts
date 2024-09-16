import {
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import { QuaiTransaction, TransactionReceipt } from "quais"

import { QuaiTransactionDB } from "../types"
import { QuaiTransactionStatus } from "../../chain/types"

// FIXME
export const quaiTransactionFromRequest = (
  request: QuaiTransactionRequest | QuaiTransaction,
  status: QuaiTransactionStatus
): QuaiTransactionDB => {
  return {
    to: request.to?.toString() ?? "",
    // @ts-ignore
    from: request.from.toString(),
    chainId: Number(request.chainId) ?? 0,
    hash: "",
    data: request.data ?? null,
    gasLimit: null,
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
    nonce: request.nonce ?? null,
    status,
    type: null,
    value: null,
    index: BigInt(0),
    blockNumber: null,
    gasPrice: null,
    gasUsed: null,
  }
}

export const quaiTransactionFromResponse = (
  transactionResponse: QuaiTransactionResponse,
  status: QuaiTransactionStatus
): QuaiTransactionDB => {
  return {
    to: transactionResponse.to ?? "",
    from: transactionResponse.from,
    chainId: Number(transactionResponse.chainId),
    hash: transactionResponse.hash,
    data: transactionResponse.data,
    gasLimit: transactionResponse.gasLimit,
    maxFeePerGas: transactionResponse.maxFeePerGas,
    maxPriorityFeePerGas: transactionResponse.maxPriorityFeePerGas,
    nonce: transactionResponse.nonce,
    status,
    type: transactionResponse.type,
    value: transactionResponse.value,
    index: transactionResponse.index,
    blockNumber: null,
    gasPrice: null,
    gasUsed: null,
  }
}

export const quaiTransactionFromReceipt = (
  transactionResponse: QuaiTransactionDB,
  receipt: TransactionReceipt,
  status: QuaiTransactionStatus
): QuaiTransactionDB => {
  return {
    to: transactionResponse.to ?? "",
    from: transactionResponse.from,
    chainId: Number(transactionResponse.chainId),
    hash: transactionResponse.hash,
    data: transactionResponse.data,
    gasLimit: transactionResponse.gasLimit,
    maxFeePerGas: transactionResponse.maxFeePerGas,
    maxPriorityFeePerGas: transactionResponse.maxPriorityFeePerGas,
    nonce: transactionResponse.nonce,
    status,
    type: transactionResponse.type,
    value: transactionResponse.value,
    index: transactionResponse.index,
    blockNumber: receipt.blockNumber,
    gasPrice: receipt.gasPrice,
    gasUsed: receipt.gasUsed,
  }
}
