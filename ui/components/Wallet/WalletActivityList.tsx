import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { setShowingActivityDetail } from "@pelagus/pelagus-background/redux-slices/ui"
import {
  selectCurrentAccount,
  selectCurrentNetwork,
  selectShowingActivityDetail,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { useTranslation } from "react-i18next"
import { Activity } from "@pelagus/pelagus-background/redux-slices/activities"
import {
  ALCHEMY_SUPPORTED_CHAIN_IDS,
  CurrentShardToExplorer,
} from "@pelagus/pelagus-background/constants"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import WalletActivityDetails from "./WalletActivityDetails"
import WalletActivityListItem from "./WalletActivityListItem"
import { blockExplorer } from "../../utils/constants"
import SharedButton from "../Shared/SharedButton"

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

  const account = useBackgroundSelector(selectCurrentAccount)

  // Used to fix Tx Details Slide-up menu should close
  // when extension closes. (#618)
  const [instantlyHideActivityDetails, setInstantlyHideActivityDetails] =
    useState(true)

  const network = useBackgroundSelector(selectCurrentNetwork)
  const blockExplorerInfo = network.isQuai
    ? {
        title: blockExplorer[network.chainID].title,
        url: CurrentShardToExplorer(network, account.address),
      }
    : blockExplorer[network.chainID]

  useEffect(() => {
    setInstantlyHideActivityDetails(true)
    dispatch(setShowingActivityDetail(null))
  }, [dispatch])

  const activityInitiatorAddress =
    useBackgroundSelector(selectCurrentAccount).address

  const openExplorer = useCallback(() => {
    window
      .open(
        `${blockExplorerInfo.url}/address/${activityInitiatorAddress}`,
        "_blank"
      )
      ?.focus()
  }, [blockExplorerInfo, activityInitiatorAddress])

  const handleOpen = useCallback(
    (activityItem: Activity) => {
      setInstantlyHideActivityDetails(false)
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
        {ALCHEMY_SUPPORTED_CHAIN_IDS.has(network.chainID)
          ? t("historicalActivityExplainer")
          : t("defaultHistoricalActivityExplainer")}
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
            margin: 0 auto;
            margin-top: 15px;
          }
        `}</style>
      </span>
    )

  return (
    <>
      {!instantlyHideActivityDetails && (
        <SharedSlideUpMenu isOpen={!!showingActivityDetail} close={handleClose}>
          {showingActivityDetail ? (
            <WalletActivityDetails
              activityItem={showingActivityDetail}
              activityInitiatorAddress={activityInitiatorAddress}
            />
          ) : (
            <></>
          )}
        </SharedSlideUpMenu>
      )}
      <ul>
        {activities.map((activityItem) => {
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
      </ul>
      <span>
        <div className="hand">✋</div>
        <div>{t("endOfList")}</div>
        {blockExplorerInfo && (
          <div className="row">
            {t("moreHistory")}
            <SharedButton
              type="tertiary"
              size="small"
              iconSmall="new-tab"
              onClick={openExplorer}
              style={{ padding: 0, fontWeight: 400 }}
            >
              {blockExplorerInfo?.title}
            </SharedButton>
          </div>
        )}
        <style jsx>{`
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
            margin: 10px 0px;
            font-size: 22px;
          }
          div:last-child {
            margin-bottom: 40px;
          }
        `}</style>
      </span>
    </>
  )
}
