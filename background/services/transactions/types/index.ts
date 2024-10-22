import { BigNumberish, LogParams } from "quais"
import { EtxParams } from "quais/lib/commonjs/providers/formatting"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"

import { TransactionAnnotation } from "../../enrichment"
import { NetworkInterface } from "../../../constants/networks/networkTypes"

export enum TransactionStatus {
  FAILED = 0,
  PENDING = 1,
  CONFIRMED = 2,
}

export type QuaiTransactionDB = {
  to: string
  from: string
  hash: string
  chainId: number
  type: number | null
  data: string | null
  nonce: number | null
  status: TransactionStatus

  gasUsed?: bigint | null
  gasLimit: BigNumberish | null
  gasPrice: BigNumberish | null
  minerTip: BigNumberish | null

  index: bigint
  value: BigNumberish | null
  blockHash: string | null
  blockNumber: number | null

  outboundEtxs: EtxParams[]
  logs: LogParams[]
}

export enum UtxoActivityType {
  RECEIVE = 0,
  SEND = 1,
  CONVERT = 2,
}

export type QiTransactionDB = {
  senderPaymentCode: string
  receiverPaymentCode: string
  hash: string
  chainId: number
  value: number
  type: UtxoActivityType
  status: TransactionStatus
  timestamp: number
  blockHash: string | null
  blockNumber: number | null
}

export type EnrichedQuaiTransaction = QuaiTransactionDB & {
  annotation?: TransactionAnnotation
  network: NetworkInterface
}

export type QuaiTransactionRequestWithAnnotation = QuaiTransactionRequest & {
  annotation?: TransactionAnnotation
  network: NetworkInterface
}
