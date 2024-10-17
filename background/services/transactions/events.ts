import { HexString } from "../../types"
import { QiTransactionDB, QuaiTransactionDB } from "./types"
import { ServiceLifecycleEvents } from "../types"
import { AddressOnNetwork } from "../../accounts"

export interface TransactionServiceEvents extends ServiceLifecycleEvents {
  transactionSend: HexString
  transactionSendFailure: undefined

  initializeQuaiTransactions: {
    transactions: QuaiTransactionDB[]
    accounts: AddressOnNetwork[]
  }

  updateQuaiTransaction: {
    transaction: QuaiTransactionDB
    forAccounts: string[]
  }

  addUtxoActivity: QiTransactionDB
  updateUtxoActivity: QiTransactionDB
  initializeQiTransactions: QiTransactionDB[]
}
