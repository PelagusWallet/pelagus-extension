import { QuaiTransactionResponse } from "quais/lib/commonjs/providers"

import { QuaiTransactionDB, QuaiTransactionStatus } from "../types"

export const quaiTransactionFromResponse = (
  transactionResponse: QuaiTransactionResponse,
  status: QuaiTransactionStatus
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
