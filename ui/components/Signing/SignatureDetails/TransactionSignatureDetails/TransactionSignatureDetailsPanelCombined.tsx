import React, { ReactElement } from "react"
import DetailsPanel from "./DetailsPanel"
import RawDataPanel from "./RawDataPanel"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/transactions/types"

export default function TransactionSignatureDetailsPanelCombined({
  transactionRequest,
}: {
  transactionRequest: QuaiTransactionRequestWithAnnotation
}): ReactElement {
  return (
    <>
      <DetailsPanel transactionRequest={transactionRequest} />
      <RawDataPanel transactionRequest={transactionRequest} />
    </>
  )
}
