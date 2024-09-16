import { HexString } from "../../types"
import { QuaiTransactionDB } from "./types"
import { ServiceLifecycleEvents } from "../types"

export interface TransactionServiceEvents extends ServiceLifecycleEvents {
  transactionSend: HexString
  transactionSendFailure: undefined

  transactions: QuaiTransactionDB[]

  transaction: {
    forAccounts: string[]
    transaction: QuaiTransactionDB
  }
}
