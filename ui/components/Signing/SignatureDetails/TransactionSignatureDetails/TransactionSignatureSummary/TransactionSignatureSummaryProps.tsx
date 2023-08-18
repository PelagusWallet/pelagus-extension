import {
  EnrichedEVMTransactionRequest,
  TransactionAnnotation,
} from "@pelagus/pelagus-background/services/enrichment"

export type TransactionSignatureSummaryProps<
  T extends TransactionAnnotation | undefined =
    | TransactionAnnotation
    | undefined
> = {
  transactionRequest: EnrichedEVMTransactionRequest
  annotation: T
}
