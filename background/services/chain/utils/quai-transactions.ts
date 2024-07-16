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
    chainId,
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
    chainId,
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
    gasPrice,
  } = transaction

  const serializedChainId = chainId ? chainId.toString() : ""
  switch (status) {
    case QuaiTransactionStatus.FAILED:
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
        etxs: [],
        gasPrice,
        logs: [],
        gasUsed: undefined,
      }

    case QuaiTransactionStatus.PENDING:
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
        etxs: [],
        gasPrice,
        logs: [],
        gasUsed: undefined,
      }

    case QuaiTransactionStatus.CONFIRMED:
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
        etxs: transaction?.etxs,
        gasPrice,
        logs: transaction?.logs,
        gasUsed: transaction?.gasPrice,
      }

    default:
      return {
        to: undefined,
        from: undefined,
        chainId: undefined,
        hash: "",
        blockHash: null,
        accessList: undefined,
        data: undefined,
        gasLimit: undefined,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
        nonce: undefined,
        signature: undefined,
        status: 0,
        type: null,
        value: undefined,
        index: toBigInt(0),
        blockNumber: null,
        etxs: [],
        gasPrice: undefined,
        logs: [],
        gasUsed: undefined,
      }
  }
}
