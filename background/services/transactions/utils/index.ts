import {
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import { QuaiTransaction, TransactionReceipt } from "quais"

import { QuaiTransactionDB } from "../types"
import { QuaiTransactionStatus } from "../../chain/types"

export const quaiTransactionFromRequest = (
  request: QuaiTransactionRequest | QuaiTransaction,
  status: QuaiTransactionStatus
): QuaiTransactionDB => {
  return {
    to: request.to?.toString() ?? "",
    from: request?.from ? request?.from.toString() : "",
    chainId: Number(request.chainId) ?? 0,
    hash: crypto.randomUUID(), // TODO: NEED TO CONFIRM THIS (TEMPORARY)
    data: request.data ?? null,
    gasLimit: null,
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
    nonce: request.nonce ?? null,
    status,
    type: null,
    value: request?.value ?? null,
    index: BigInt(0),
    blockHash: null,
    blockNumber: null,
    gasPrice: null,
    gasUsed: null,
    etxs: [],
    logs: [],
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
    blockHash: null,
    blockNumber: null,
    gasPrice: null,
    gasUsed: null,
    etxs: [],
    logs: [],
  }
}

export const quaiTransactionFromReceipt = (
  transactionResponse: QuaiTransactionDB,
  receipt: TransactionReceipt,
  status: QuaiTransactionStatus
): QuaiTransactionDB => {
  return {
    ...transactionResponse,
    status,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber,
    gasPrice: receipt.gasPrice,
    gasUsed: receipt.gasUsed,
    etxs: [...receipt.etxs],
    logs: [...receipt.logs],
  }
}
