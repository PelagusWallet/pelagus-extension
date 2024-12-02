import { createSelector } from "@reduxjs/toolkit"
import { formatQi, Zone } from "quais"
import type { RootState } from ".."
import {
  hardcodedMainCurrencySign,
  hardcodedMainCurrencySymbol,
} from "../utils/constants"

export const selectCurrentNetwork = createSelector(
  (state: RootState) => state.ui.selectedAccount.network,
  (selectedNetwork) => selectedNetwork
)

export const selectCurrentAccount = createSelector(
  (state: RootState) => state.ui.selectedAccount,
  ({ address, network }) => ({
    address,
    network,
    truncatedAddress: address.toLowerCase().slice(0, 7),
  })
)

export const selectShowingActivityDetail = createSelector(
  (state: RootState) => state.activities.activities,
  selectCurrentAccount,
  (state: RootState) => state.ui.showingActivityDetailID,
  (activities, currentAccountOnNetwork, showingActivityDetailID) => {
    if (!showingActivityDetailID) return null

    return (
      activities[currentAccountOnNetwork.address]?.[
        currentAccountOnNetwork.network.chainID
      ]?.find((activity) => activity.hash === showingActivityDetailID) ?? null
    )
  }
)

export const selectCurrentAddressNetwork = createSelector(
  (state: RootState) => state.ui.selectedAccount,
  (selectedAccount) => selectedAccount
)

export const selectMainCurrencySymbol = createSelector(
  (state: RootState) => state,
  () => hardcodedMainCurrencySymbol
)

export const selectMainCurrencySign = createSelector(
  () => null,
  () => hardcodedMainCurrencySign
)

export const selectMainCurrency = createSelector(
  (state: RootState) => state.ui,
  (state: RootState) => state.assets,
  (state: RootState) => selectMainCurrencySymbol(state),
  (_, assets, mainCurrencySymbol) =>
    assets.find((asset) => asset.symbol === mainCurrencySymbol)
)

export const selectIsUtxoSelected = createSelector(
  (state: RootState) => state.ui.isUtxoSelected,
  (isUtxo) => isUtxo
)

export const selectCurrentUtxoAccount = createSelector(
  (state: RootState) => state.ui.selectedUtxoAccount,
  (utxoAcc) => utxoAcc
)

export const selectQiBalanceForCurrentUtxoAccountCyprus1 = createSelector(
  (state: RootState) => state.ui.selectedUtxoAccount?.balances,
  (balances) => {
    const spendableAmount = balances?.[Zone.Cyprus1]?.assetAmount?.amount
    const formattedSpendableAmount =
      spendableAmount !== undefined &&
      spendableAmount !== null &&
      !isNaN(Number(spendableAmount))
        ? formatQi(spendableAmount)
        : null

    const lockedAmount = balances?.[Zone.Cyprus1]?.lockedAmount?.amount
    const formattedLockedAmount =
      lockedAmount !== undefined &&
      lockedAmount !== null &&
      !isNaN(Number(lockedAmount))
        ? formatQi(lockedAmount)
        : null

    return {
      spendableAmount: formattedSpendableAmount,
      lockedAmount: formattedLockedAmount,
    }
  }
)
