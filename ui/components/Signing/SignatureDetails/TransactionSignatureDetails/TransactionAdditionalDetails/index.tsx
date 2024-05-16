import React, { ReactElement } from "react"
import { TransactionSignatureSummaryProps } from "../TransactionSignatureSummary/TransactionSignatureSummaryProps"

export default function TransactionAdditionalDetails({
  transactionRequest,
  annotation,
}: TransactionSignatureSummaryProps): ReactElement {
  switch (annotation?.type) {
    default:
      return <></>
  }
}
