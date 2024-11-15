import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { setShowingActivityDetail } from "@pelagus/pelagus-background/redux-slices/ui"
import {
  selectCurrentAccount,
  selectShowingActivityDetail,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { useTranslation } from "react-i18next"
import { Activity } from "@pelagus/pelagus-background/redux-slices/activities"
import _ from "lodash"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import WalletActivityDetails from "./WalletActivityDetails"
import WalletActivityListItem from "./WalletActivityListItem"
import SharedModalWrapper from "../Shared/_newDeisgn/modalWrapper/SharedModalWrapper"
import SharedModalHeaders from "../Shared/_newDeisgn/modalWrapper/SharedModalHeaders"

type Props = {
  activities: Activity[]
}

export default function WalletActivityList({
  activities,
}: Props): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet.activities",
  })
  const dispatch = useBackgroundDispatch()
  const showingActivityDetail = useBackgroundSelector(
    selectShowingActivityDetail
  )

  useEffect(() => {
    dispatch(setShowingActivityDetail(null))
  }, [dispatch])

  const activityInitiatorAddress =
    useBackgroundSelector(selectCurrentAccount).address

  const handleOpen = useCallback(
    (activityItem: Activity) => {
      dispatch(setShowingActivityDetail(activityItem.hash))
    },
    [dispatch]
  )

  const handleClose = useCallback(() => {
    dispatch(setShowingActivityDetail(null))
  }, [dispatch])

  if (!activities || activities.length === 0)
    return (
      <span>
        {t("defaultHistoricalActivityExplainer")}
        <style jsx>{`
          span {
            width: 316px;
            display: flex;
            flex-direction: column;
            align-items: center;
            color: var(--green-40);
            font-size: 16px;
            text-align: center;
            line-height: 22px;
            margin: 15px auto 0 auto;
          }
        `}</style>
      </span>
    )

  const groupedQuaiActivities = _(activities)
    .orderBy((v) => v?.blockTimestamp && new Date(v.blockTimestamp), ["desc"])
    .groupBy((v) =>
      new Date(v.blockTimestamp ?? new Date()).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    )
    .value()

  return (
    <>
      <ul style={{ width: "100%" }}>
        {Object.entries(groupedQuaiActivities).map(([date, evmActivities]) => (
          <li className="quai-activity-list" key={date}>
            <h3 className="date-heading">{date}</h3>
            {evmActivities.map((activityItem) => {
              if (activityItem) {
                return (
                  <WalletActivityListItem
                    onClick={() => {
                      handleOpen(activityItem)
                    }}
                    key={activityItem?.hash}
                    activity={activityItem}
                    activityInitiatorAddress={activityInitiatorAddress}
                  />
                )
              }
              return <></>
            })}
          </li>
        ))}
      </ul>

      <SharedModalWrapper
        footer={<></>}
        header={
          <SharedModalHeaders
            title="Review Transaction"
            onClose={handleClose}
            withGoBackIcon={false}
          />
        }
        isOpen={!!showingActivityDetail}
        onClose={handleClose}
        customStyles={{ alignItems: "flex-end" }}
      >
        {showingActivityDetail && (
          <WalletActivityDetails
            activityItem={showingActivityDetail}
            activityInitiatorAddress={activityInitiatorAddress}
          />
        )}
      </SharedModalWrapper>

      <style jsx>{`
        .quai-activity-list {
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
        }

        .date-heading {
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          color: var(--secondary-text);
          margin: 0 24px 4px 24px;
        }

        span {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          color: var(--green-20);
          font-size: 16px;
          font-weight: 400;
          line-height: 24px;
          text-align: center;
        }
        .row {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
        }
        .hand {
          margin: 10px 0;
          font-size: 22px;
        }
        div:last-child {
          margin-bottom: 40px;
        }
      `}</style>
    </>
  )
}
