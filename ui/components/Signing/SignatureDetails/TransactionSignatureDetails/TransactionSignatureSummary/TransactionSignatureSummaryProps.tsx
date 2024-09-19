import { TransactionAnnotation } from "@pelagus/pelagus-background/services/enrichment"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/transactions/types"

export type TransactionSignatureSummaryProps<
  T extends TransactionAnnotation | undefined =
    | TransactionAnnotation
    | undefined
> = {
  transactionRequest: QuaiTransactionRequestWithAnnotation
  annotation: T
}
