import {
  QiTransactionResponse,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
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

// export const qiTransactionFromResponse = (
//   response: QiTransactionResponse,
//   amountSent: number,
//   changeAddresses: NeuteredAddressInfo[],
//   status: TransactionStatus
// ): QiTransactionDB => {
//   const { txOutputs } = response
//
//   const initialChange = 0
//   const outputsChange = txOutputs?.reduce((accumulator, txOutput) => {
//     const { address, denomination } = txOutput
//
//     const isMatch = changeAddresses.some(
//       (changeAddress) => changeAddress.address === address
//     )
//     if (isMatch) {
//       return accumulator + denomination
//     }
//
//     return accumulator
//   }, initialChange)
//
//   const value = amountSent - (outputsChange ?? initialChange)
//
//   return {
//     hash: response.hash,
//     chainId: Number(response.chainId),
//     value,
//     status,
//     blockHash: response.blockHash || null,
//     blockNumber: response.blockNumber || null,
//   }
// }

export const processSentQiTransaction = (
  senderPaymentCode: string,
  receiverPaymentCode: string,
  tx: QiTransactionResponse,
  amount: number
): QiTransactionDB => {
  return {
    senderPaymentCode,
    receiverPaymentCode,
    hash: tx.hash,
    chainId: Number(tx.chainId),
    value: amount,
    type: UtxoActivityType.SEND,
    timestamp: Date.now(),
    status: TransactionStatus.PENDING,
    blockHash: tx.blockHash || null,
    blockNumber: tx.blockNumber || null,
  }
}

export const getUniqueQiTransactionHashes = (
  outpointInfos: OutpointInfo[]
): string[] => {
  const uniqueHashes = new Set<string>(
    outpointInfos.map((info) => info.outpoint.txhash)
  )
  return Array.from(uniqueHashes)
}
