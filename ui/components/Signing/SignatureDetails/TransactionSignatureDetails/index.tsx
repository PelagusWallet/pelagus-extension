import React, { ReactElement } from "react"
import TransactionSignatureDetailsPanelSwitcher from "./TransactionSignatureDetailsPanelSwitcher"
import TransactionSignatureDetailsPanelCombined from "./TransactionSignatureDetailsPanelCombined"
import TransactionSignatureSummary from "./TransactionSignatureSummary"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/transactions/types"

export type TransactionSignatureDetailsProps = {
  transactionRequest: QuaiTransactionRequestWithAnnotation
}

export default function TransactionSignatureDetails({
  transactionRequest,
}: TransactionSignatureDetailsProps): ReactElement {
  const { annotation } = transactionRequest
  const annotatedTransactionType = annotation?.type ?? "contract-interaction"

  return (
    <>
      <div className="standard_width">
        <TransactionSignatureSummary
          transactionRequest={transactionRequest}
          annotation={annotation}
        />
      </div>
      {annotatedTransactionType === "contract-interaction" ? (
        <TransactionSignatureDetailsPanelCombined
          transactionRequest={transactionRequest}
        />
      ) : (
        <TransactionSignatureDetailsPanelSwitcher
          transactionRequest={transactionRequest}
        />
      )}
    </>
  )
}
