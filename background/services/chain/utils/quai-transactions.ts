import { toBigInt, TransactionReceiptParams } from "quais"
import { QuaiTransactionResponse } from "quais/lib/commonjs/providers"
import { QuaiTransactionLike } from "quais/lib/commonjs/transaction/quai-transaction"
import {
  ConfirmedQuaiTransaction,
  FailedQuaiTransaction,
  PendingQuaiTransaction,
  QuaiTransactionState,
  QuaiTransactionStatus,
  SerializedTransactionForHistory,
} from "../types"

export const createFailedQuaiTransaction = (
  transaction: QuaiTransactionResponse | QuaiTransactionLike,
  error?: string
): FailedQuaiTransaction => {
  return {
    ...transaction,
    status: QuaiTransactionStatus.FAILED,
    error: error || "Unknown error",
    blockHash: null,
    blockHeight: null,
  }
}

export const createConfirmedQuaiTransaction = (
  transaction: QuaiTransactionLike,
  receipt: TransactionReceiptParams
): ConfirmedQuaiTransaction => {
  const {
    nonce,
    gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
    data,
    value,
    accessList,
  } = transaction

  const { status, ...rest } = receipt

  return {
    status: QuaiTransactionStatus.CONFIRMED,
    nonce,
    gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
    data,
    value,
    accessList,
    ...rest,
  }
}

export const createPendingQuaiTransaction = (
  responseParams: QuaiTransactionResponse
): PendingQuaiTransaction => {
  return {
    ...responseParams,
    status: QuaiTransactionStatus.PENDING,
  }
}

export const createSerializedQuaiTransaction = (
  transaction: QuaiTransactionState
): SerializedTransactionForHistory => {
  const {
    to,
    from,
    chainId,
    hash,
    blockHash,
    accessList,
    data,
    gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
    nonce,
    signature,
    status,
    type,
    value,
  } = transaction

  const serializedChainId = chainId ? chainId.toString() : ""

  if (status !== QuaiTransactionStatus.FAILED)
    return {
      to,
      from,
      chainId: serializedChainId,
      hash: hash ?? "",
      blockHash,
      accessList,
      data,
      gasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas,
      nonce,
      signature,
      status,
      type,
      value,
      index: toBigInt(transaction?.index ?? 0),
      blockNumber: transaction.blockNumber,
    }

  return {
    to,
    from,
    chainId: serializedChainId,
    hash: hash ?? "",
    blockHash,
    accessList,
    data,
    gasLimit,
    maxPriorityFeePerGas,
    maxFeePerGas,
    nonce,
    signature,
    status,
    type,
    value,
    blockNumber: null,
    index: toBigInt(0),
  }
}
