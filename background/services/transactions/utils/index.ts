import {
  QiTransactionResponse,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import { formatQi } from "quais"
import { NeuteredAddressInfo } from "quais/lib/commonjs/wallet/hdwallet"
import { OutpointInfo } from "quais/lib/commonjs/wallet/qi-hdwallet"
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

export const processFailedQiTransaction = (
  senderPaymentCode: string,
  receiverPaymentCode: string,
  amount: bigint,
  chainId: string
): QiTransactionDB => {
  return {
    senderPaymentCode,
    receiverPaymentCode,
    hash: "",
    chainId: Number(chainId),
    value: Number(formatQi(amount)),
    type: UtxoActivityType.SEND,
    timestamp: Date.now(),
    status: TransactionStatus.FAILED,
    blockHash: null,
    blockNumber: null,
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

export const processConvertQiTransaction = (
  senderPaymentCode: string,
  receiverAddress: string,
  tx: QiTransactionResponse,
  amount: bigint
): QiTransactionDB => {
  return {
    senderPaymentCode,
    receiverPaymentCode: receiverAddress,
    hash: tx.hash,
    chainId: Number(tx.chainId),
    value: Number(formatQi(amount)),
    type: UtxoActivityType.CONVERT,
    timestamp: Date.now(),
    status: TransactionStatus.PENDING,
    blockHash: tx.blockHash || null,
    blockNumber: tx.blockNumber || null,
  }
}

export const processReceivedQiTransaction = (
  response: QiTransactionResponse,
  timestamp: number,
  walletAddresses: NeuteredAddressInfo[],
  receiverPaymentCode: string
): QiTransactionDB => {
  const { txOutputs } = response

  const outputsValue = txOutputs?.reduce((accumulator, txOutput) => {
    const { address, denomination } = txOutput

    const isMatch = walletAddresses.some(
      (changeAddress) => changeAddress.address === address
    )
    if (isMatch) {
      return accumulator + denomination
    }

    return accumulator
  }, 0)

  return {
    senderPaymentCode: "",
    receiverPaymentCode,
    hash: response.hash,
    chainId: Number(response.chainId),
    value: outputsValue ?? 0,
    status: TransactionStatus.CONFIRMED,
    type: UtxoActivityType.RECEIVE,
    timestamp: timestamp * 1000,
    blockHash: response.blockHash || null,
    blockNumber: response.blockNumber || null,
  }
}

export const getUniqueQiTransactionHashes = (
  outpointInfos: OutpointInfo[],
  transactionsInDB: QiTransactionDB[]
): string[] => {
  const existingHashes = new Set(transactionsInDB.map((tx) => tx.hash))

  const uniqueHashes = new Set<string>(
    outpointInfos
      .map((info) => info.outpoint.txhash)
      // filter out hashes that already exist in the database
      .filter((hash) => !existingHashes.has(hash))
  )

  return Array.from(uniqueHashes)
}
