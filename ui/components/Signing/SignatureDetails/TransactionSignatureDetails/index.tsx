import React, { ReactElement } from "react"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/chain/types"
import TransactionSignatureDetailsPanelSwitcher from "./TransactionSignatureDetailsPanelSwitcher"
import TransactionSignatureDetailsPanelCombined from "./TransactionSignatureDetailsPanelCombined"
import TransactionSignatureSummary from "./TransactionSignatureSummary"

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
