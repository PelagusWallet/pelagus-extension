import { createSelector } from "@reduxjs/toolkit"
import { selectCurrentAccount, selectCurrentNetwork } from "./uiSelectors"
import { RootState } from ".."
import { TransactionStatus } from "../../services/transactions/types"

export const selectCurrentAccountActivities = createSelector(
  (state: RootState) => state.activities.activities,
  selectCurrentAccount,
  selectCurrentNetwork,
  (activities, account, network) => {
    return activities?.[account.address]?.[network.chainID] ?? []
  }
)

export const selectActivitiesHashesForEnrichment = createSelector(
  selectCurrentAccountActivities,
  (currentActivities) => {
    // Only need to enrich current activities if they don't have a blockTimestamp already
    // Once they have a block hash, they've been included and enriched already
    return currentActivities.flatMap((activity) =>
      !activity.blockTimestamp && activity.status !== TransactionStatus.FAILED
        ? {
            hash: activity.hash,
            status: activity.status,
            to: activity.to,
            from: activity.from,
          }
        : []
    )
  }
)

export const selectCurrentAccountUtxoActivities = createSelector(
  (state: RootState) => state.activities.utxoActivities,
  (state: RootState) => state.ui.selectedUtxoAccount,
  selectCurrentNetwork,
  (activities, account, network) => {
    if (!account) return []
    return activities[account?.paymentCode]?.[network.chainID] ?? []
  }
)
