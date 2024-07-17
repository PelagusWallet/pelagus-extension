import { createSelector } from "@reduxjs/toolkit"
import { selectCurrentAccount, selectCurrentNetwork } from "./uiSelectors"
import { RootState } from ".."

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
      !activity.blockTimestamp
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
