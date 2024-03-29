import React, { ReactElement } from "react"
import { EnrichedEVMTransactionRequest } from "@pelagus/pelagus-background/services/enrichment"
import TransactionSignatureDetailsPanelSwitcher from "./TransactionSignatureDetailsPanelSwitcher"
import TransactionSignatureDetailsPanelCombined from "./TransactionSignatureDetailsPanelCombined"
import TransactionSignatureSummary from "./TransactionSignatureSummary"

export type TransactionSignatureDetailsProps = {
  transactionRequest: EnrichedEVMTransactionRequest
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
