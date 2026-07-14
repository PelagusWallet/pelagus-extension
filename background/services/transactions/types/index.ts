import { BigNumberish, LogParams } from "quais"
import { EtxParams } from "quais/lib/commonjs/providers/formatting"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"

import { TransactionAnnotation } from "../../enrichment"
import { NetworkInterface } from "../../../constants/networks/networkTypes"

export enum TransactionStatus {
  FAILED = 0,
  PENDING = 1,
  CONFIRMED = 2,
  REVERTED = 3,
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
  refundAddress?: string
  quaiRecipient?: string
}

export type EnrichedQuaiTransaction = QuaiTransactionDB & {
  annotation?: TransactionAnnotation
  network: NetworkInterface
}

export type QuaiTransactionRequestWithAnnotation = QuaiTransactionRequest & {
  annotation?: TransactionAnnotation
  network: NetworkInterface
}

export type QiOutputRequest = {
  address: string
  denomination?: number | string
  amountQit?: BigNumberish
  valueQit?: BigNumberish
}

export type QiReceiveAddressesRequest = {
  count?: unknown
  zone?: unknown
  account?: unknown
  /** Required origin-scoped durable lease key for the p2p Qi receive API. */
  reservationId: unknown
  /** Set only by the provider bridge from the trusted requesting origin. */
  origin?: unknown
}

export type QiReceiveAddressReservationStatus =
  | "active"
  | "committed"
  | "released"

export type QiReceiveAddressReservationReleaseReason = "terminal"

export type QiReceiveAddressReservationControlRequest = {
  reservationId?: unknown
  count?: unknown
  zone?: unknown
  account?: unknown
  /** Set only by the provider bridge from the trusted requesting origin. */
  origin?: unknown
}

export type QiReceiveAddressReservationReleaseRequest =
  QiReceiveAddressReservationControlRequest & {
    reason?: unknown
  }

export type QiReceiveAddressReservationResponse = {
  reservationId: string
  addresses: string[]
  status: "active" | "committed"
  /** Active quotes expire; committed trade addresses do not. */
  expiresAt: number | null
  committedAt?: number
}

export type QiReceiveAddressReservationReleaseResponse = {
  reservationId: string
  status: "released"
  releasedAt: number
  alreadyReleased: boolean
}

export type QiSendToOutputsRequest = {
  outputs?: QiOutputRequest[]
  /**
   * The Quai network the dapp expects to sign on. This is required for
   * dapp-originated Qi sends and must match the wallet's selected network.
   * Decimal and 0x-prefixed JSON strings are accepted; the normalized request
   * always stores a canonical decimal string.
   */
  chainId?: number | string
  zone?: string
  account?: number
  data?: string
  origin?: string
  label?: string
  tradeHash?: string
  /**
   * Maximum fee the dapp authorizes, in qit. The wallet still displays the
   * exact prepared fee and requires user confirmation before signing.
   */
  maxFeeQit?: BigNumberish
  /**
   * Optional caller deadline expressed as Unix epoch milliseconds. Pelagus
   * binds this value to the reviewed request and will never sign or broadcast
   * after it. Production p2p-qi funding requests must provide this field.
   */
  validUntil?: number | string
}

export type PreparedQiSendInput = {
  txhash: string
  index: number
  address: string
  denomination: number
  lock?: number
  valueQit: string
  chainID: string
  derivationPath: string
}

export type PreparedQiSendToOutputs = {
  preparedId: string
  unsignedSerialized: string
  digest: string
  /** Hash of the complete normalized dapp request shown in confirmation. */
  requestFingerprint: string
  inputs: PreparedQiSendInput[]
  outputs: Array<{ address: string; denomination: number }>
  changeOutputs: Array<{ address: string; denomination: number }>
  amountQit: string
  feeQit: string
  maxFeeQit: string
  inputTotalQit: string
  totalDebitQit: string
  sourceAccount: number
  sourcePaymentCode: string
  preparedAt: number
  expiresAt: number
}

export type NormalizedQiSendToOutputsRequest = {
  outputs: Array<{
    address: string
    denomination: number
  }>
  amountQit: string
  // Canonical decimal Quai network id, bound to the wallet network at both
  // confirmation creation and signing time.
  chainId: string
  zone: string
  account: number
  maxFeeQit: string
  /** Canonical safe Unix epoch milliseconds supplied by the dapp. */
  validUntil?: number
  data?: string
  origin?: string
  label?: string
  tradeHash?: string
  // Unique id assigned when the request enters the confirmation flow; used to
  // correlate the confirmation/rejection back to the exact pending request.
  requestId?: string
  /** Exact unsigned transaction approved by the user; produced by Pelagus. */
  prepared?: PreparedQiSendToOutputs
}
