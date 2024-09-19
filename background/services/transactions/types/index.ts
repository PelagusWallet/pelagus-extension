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
  gasPrice: BigNumberish | null
  gasLimit: BigNumberish | null
  maxFeePerGas: BigNumberish | null
  maxPriorityFeePerGas: BigNumberish | null

  index: bigint
  value: BigNumberish | null
  blockHash: string | null
  blockNumber: number | null

  etxs: EtxParams[]
  logs: LogParams[]
}

export type EnrichedQuaiTransaction = QuaiTransactionDB & {
  annotation?: TransactionAnnotation
  network: NetworkInterface
}

export type QuaiTransactionRequestWithAnnotation = QuaiTransactionRequest & {
  annotation?: TransactionAnnotation
  network: NetworkInterface
}
