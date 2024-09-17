import { createSelector } from "@reduxjs/toolkit"
import { RootState } from ".."

const getCurrentAccountState = (state: RootState) => {
  const { address, network } = state.ui.selectedAccount
  return state.account.accountsData.evm[network.chainID]?.[address]
}

export const selectCurrentAccountTransactions = createSelector(
  [
    getCurrentAccountState,
    (state: RootState) => state.transactions.quaiTransactions,
  ],
  (currentAccount, quaiTransactions) => {
    if (!currentAccount || typeof currentAccount === "string") return []

    const selectedAddress = currentAccount.address

    const transactions = quaiTransactions[selectedAddress]?.transactions
      ? Object.values(quaiTransactions[selectedAddress].transactions)
      : []

    return transactions
  }
)
