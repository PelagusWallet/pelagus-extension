import { BigNumberish, LogParams } from "quais"
import { EtxParams } from "quais/lib/commonjs/providers/formatting"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
import { TransactionAnnotation } from "../../enrichment"
import { NetworkInterface } from "../../../constants/networks/networkTypes"

export enum QuaiTransactionStatus {
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
  status: QuaiTransactionStatus

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

export type QiTransactionDB = {
  to: string
  from: string
  hash: string
  chainId: number
  nonce: number | null
  value: BigNumberish | null
  status: QuaiTransactionStatus
  gasLimit: BigNumberish | null
  gasPrice: BigNumberish | null
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
