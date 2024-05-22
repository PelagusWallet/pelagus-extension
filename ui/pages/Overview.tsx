import React, { ReactElement } from "react"
import {
  getAddressCount,
  getNetworkCountForOverview,
  getTotalBalanceForOverview,
  selectAccountAndTimestampedActivities,
  selectAccountTotalsForOverview,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { selectInitializationTimeExpired } from "@pelagus/pelagus-background/redux-slices/ui"
import { useBackgroundSelector } from "../hooks"
import OverviewAssetsTable from "../components/Overview/OverviewAssetsTable"
import BalanceHeader from "../components/Overview/BalanceHeader"
import NetworksChart from "../components/Overview/NetworksChart"
import AccountList from "../components/Overview/AccountList"
import AbilitiesHeader from "../components/Overview/AbilitiesHeader"

export default function Overview(): ReactElement {
  const accountsTotal = useBackgroundSelector(selectAccountTotalsForOverview)
  const balance = useBackgroundSelector(getTotalBalanceForOverview)
  const networksCount = useBackgroundSelector(getNetworkCountForOverview)
  const accountsCount = useBackgroundSelector(getAddressCount)

  const { combinedData } = useBackgroundSelector(
    selectAccountAndTimestampedActivities
  )
  const initializationLoadingTimeExpired = useBackgroundSelector(
    selectInitializationTimeExpired
  )

  return (
    <section className="stats">
      <BalanceHeader
        balance={balance}
        initializationTimeExpired={initializationLoadingTimeExpired}
      />
      <AbilitiesHeader />
      <AccountList
        accountsTotal={accountsTotal}
        accountsCount={accountsCount}
      />
      <NetworksChart
        accountsTotal={accountsTotal}
        networksCount={networksCount}
      />
      <OverviewAssetsTable
        assets={combinedData.assets}
        initializationLoadingTimeExpired={initializationLoadingTimeExpired}
      />
      <style jsx>
        {`
          .stats {
            padding: 16px 16px 24px;
            width: calc(100% - 32px);
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
        `}
      </style>
    </section>
  )
}
