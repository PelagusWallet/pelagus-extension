import {
  QiTransactionResponse,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import { formatQi } from "quais"
import {
  QiTransactionDB,
  QuaiTransactionDB,
  TransactionStatus,
  UtxoActivityType,
} from "../types"

export const quaiTransactionFromResponse = (
  transactionResponse: QuaiTransactionResponse,
  status: TransactionStatus
): QuaiTransactionDB => {
  return {
    to: transactionResponse.to ?? "",
    from: transactionResponse.from,
    chainId: Number(transactionResponse.chainId),
    hash: transactionResponse.hash,
    data: transactionResponse.data,
    gasLimit: transactionResponse.gasLimit,
    gasPrice: transactionResponse.gasPrice,
    minerTip: transactionResponse.minerTip,
    nonce: transactionResponse.nonce,
    status,
    type: transactionResponse.type,
    value: transactionResponse.value,
    index: transactionResponse.index,
    blockHash: null,
    blockNumber: null,
    gasUsed: null,
    outboundEtxs: [],
    logs: [],
  }
}

export const processSentQiTransaction = (
  senderPaymentCode: string,
  receiverPaymentCode: string,
  tx: QiTransactionResponse,
  amount: bigint
): QiTransactionDB => {
  return {
    senderPaymentCode,
    receiverPaymentCode,
    hash: tx.hash,
    chainId: Number(tx.chainId),
    value: Number(formatQi(amount)),
    type: UtxoActivityType.SEND,
    timestamp: Date.now(),
    status: TransactionStatus.PENDING,
    blockHash: tx.blockHash || null,
    blockNumber: tx.blockNumber || null,
  }
}
