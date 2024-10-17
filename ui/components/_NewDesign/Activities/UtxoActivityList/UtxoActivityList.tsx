import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { selectCurrentAccountUtxoActivities } from "@pelagus/pelagus-background/redux-slices/selectors"
import { QiTransactionDB } from "@pelagus/pelagus-background/services/transactions/types"
import UtxoActivityModal from "../UtxoActivityModal/UtxoActivityModal"
import SharedUtxoActivityTab from "../../../Shared/_newDeisgn/utxoActivityTab/SharedUtxoActivityTab"
import { useBackgroundSelector } from "../../../../hooks"

const UtxoActivityList = () => {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet.activities",
  })

  const qiActivities = useBackgroundSelector(selectCurrentAccountUtxoActivities)

  const [qiActivity, setQiActivity] = useState<QiTransactionDB | null>(null)
  const [isOpenUtxoActivityModal, setIsOpenUtxoActivityModal] = useState(false)

  const reviewQiActivityHandle = (activity: QiTransactionDB) => {
    setIsOpenUtxoActivityModal(true)
    setQiActivity(activity)
  }

  if (!qiActivities.length)
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
            margin: 15px auto 15px auto;
          }
        `}</style>
      </span>
    )

  return (
    <>
      <div className="qi-activity-list">
        {qiActivities.map((activity) => (
          <button
            className="qi-activity-item"
            type="button"
            aria-label={activity.hash}
            onClick={() => reviewQiActivityHandle(activity)}
          >
            <SharedUtxoActivityTab
              aria-label={activity.hash}
              status={activity.status}
              type={activity.type}
              value={activity.value}
              key={activity.hash}
            />
          </button>
        ))}
      </div>

      {qiActivity && isOpenUtxoActivityModal && (
        <UtxoActivityModal
          qiActivity={qiActivity}
          setIsOpenUtxoActivityModal={setIsOpenUtxoActivityModal}
        />
      )}

      <style jsx>{`
        .qi-activity-list {
          display: flex;
          flex-direction: column;
        }

        .qi-activity-item {
          transition: background-color 0.1s ease;
          border-radius: 8px;
        }

        .qi-activity-item:hover {
          background-color: var(--secondary-bg);
        }
      `}</style>
    </>
  )
}

export default UtxoActivityList
