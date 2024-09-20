import React, { ReactElement } from "react"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/transactions/types"
import DetailsPanel from "./DetailsPanel"
import RawDataPanel from "./RawDataPanel"

export default function TransactionSignatureDetailsPanelCombined({
  transactionRequest,
}: {
  transactionRequest: QuaiTransactionRequestWithAnnotation
}): ReactElement {
  console.log(
    "=== TransactionSignatureDetailsPanelCombined",
    transactionRequest
  )
  return (
    <>
      <DetailsPanel transactionRequest={transactionRequest} />
      <RawDataPanel transactionRequest={transactionRequest} />
    </>
  )
}
