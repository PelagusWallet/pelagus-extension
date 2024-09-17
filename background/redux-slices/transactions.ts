import { createSlice } from "@reduxjs/toolkit"
import { QuaiTransactionDB } from "../services/transactions/types"

type TransactionsState = {
  quaiTransactions: {
    [account: string]: {
      transactions: { [txHash: string]: QuaiTransactionDB }
    }
  }
}

const initialState: TransactionsState = {
  quaiTransactions: {},
}

const transactionsSlice = createSlice({
  name: "transactions",
  initialState,
  reducers: {
    initializeQuaiTransactions: (
      immerState,
      {
        payload,
      }: {
        payload: QuaiTransactionDB[]
      }
    ) => {
      payload.forEach((tx: QuaiTransactionDB) => {
        const { from, to, hash } = tx

        if (!immerState.quaiTransactions[from]) {
          immerState.quaiTransactions[from] = { transactions: {} }
        }

        if (!immerState.quaiTransactions[to]) {
          immerState.quaiTransactions[to] = { transactions: {} }
        }

        immerState.quaiTransactions[from].transactions[hash] = tx
        immerState.quaiTransactions[to].transactions[hash] = tx
      })
    },
    updateQuaiTransaction: (
      immerState,
      {
        payload,
      }: {
        payload: QuaiTransactionDB
      }
    ) => {
      const { from, to, hash } = payload

      if (immerState.quaiTransactions[from]) {
        immerState.quaiTransactions[from].transactions[hash] = payload
      }

      if (immerState.quaiTransactions[to]) {
        immerState.quaiTransactions[to].transactions[hash] = payload
      }
    },
  },
})

export const { initializeQuaiTransactions, updateQuaiTransaction } =
  transactionsSlice.actions

export default transactionsSlice.reducer
