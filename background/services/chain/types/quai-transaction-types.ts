import {
  AccessList,
  BigNumberish,
  SignatureLike,
  TransactionReceiptParams,
} from "quais"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
import { QuaiTransactionLike } from "quais/lib/commonjs/transaction/quai-transaction"
import { QuaiTransactionResponseParams } from "quais/lib/commonjs/providers/formatting"

import { TransactionAnnotation } from "../../enrichment"
import { NetworkInterfaceGA } from "../../../constants/networks/networkTypes"

export enum QuaiTransactionStatus {
  FAILED = 0,
  PENDING = 1,
  CONFIRMED = 2,
}

export type FailedQuaiTransaction = QuaiTransactionLike & {
  status: QuaiTransactionStatus.FAILED
  error?: string
  blockHash: null
  blockHeight: null
}

export type ConfirmedQuaiTransaction = QuaiTransactionLike &
  TransactionReceiptParams & {
    status: QuaiTransactionStatus.CONFIRMED
  }

export type PendingQuaiTransaction = QuaiTransactionLike &
  QuaiTransactionResponseParams & {
    status: QuaiTransactionStatus.PENDING
  }

export type QuaiTransactionState =
  | FailedQuaiTransaction
  | ConfirmedQuaiTransaction
  | PendingQuaiTransaction

export type EnrichedQuaiTransaction = QuaiTransactionState & {
  annotation?: TransactionAnnotation
  network: NetworkInterfaceGA
}

export type QuaiTransactionRequestWithAnnotation = QuaiTransactionRequest & {
  annotation?: TransactionAnnotation
  network: NetworkInterfaceGA
}

export type SerializedTransactionForHistory = {
  to: string | null | undefined
  from: string | undefined
  chainId: BigNumberish | null | undefined
  hash: string
  blockHash: string | null
  accessList:
    | AccessList
    | [string, string[]][]
    | Record<string, string[]>
    | ([string, string[]][] & AccessList)
    | (Record<string, string[]> & AccessList)
    | null
    | undefined
  data: string | null | undefined
  gasLimit: BigNumberish | null | undefined
  maxPriorityFeePerGas: BigNumberish | null | undefined
  maxFeePerGas: BigNumberish | null | undefined
  nonce: number | null | undefined
  signature: SignatureLike | undefined | null
  status: QuaiTransactionStatus
  type: number | null
  value: BigNumberish | null | undefined
  index: bigint
  blockNumber: number | null
}
