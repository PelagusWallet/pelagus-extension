import React, { ReactElement } from "react"

import { useTranslation } from "react-i18next"
import { Activity } from "@pelagus/pelagus-background/redux-slices/activities"
import { TransactionStatus } from "@pelagus/pelagus-background/services/transactions/types"

import classNames from "classnames"
import { utxoActivityStatusHandle } from "@pelagus/pelagus-background/redux-slices/utils/utxo-activities-utils"
import { isQiAddress } from "quais"
import { isReceiveActivity } from "../../hooks/activity-hooks"
import ReceiveIcon from "../Shared/_newDeisgn/iconComponents/ReceiveIcon"
import SendIcon from "../Shared/_newDeisgn/iconComponents/SendIcon"
import ConvertIcon from "../Shared/_newDeisgn/iconComponents/ConvertIcon"

interface Props {
  onClick?: () => void
  activity: Activity
  activityInitiatorAddress: string
  isInModal?: boolean
}

export default function WalletActivityListItem(props: Props): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet.activities",
  })
  const {
    onClick,
    activity,
    activityInitiatorAddress,
    isInModal = false,
  } = props

  const quaiActivityTabHandle = () => {
    const iconStyle = {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      background: isInModal ? "var(--tertiary-bg)" : "var(--secondary-bg)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }

    if (activity?.to && isQiAddress(activity?.to)) {
      return {
        ...activity,
        label: t("tokenConvert"),
        icon: <ConvertIcon style={iconStyle} />,
      }
    }

    switch (activity.type) {
      case "asset-transfer":
        return {
          ...activity,
          label: isReceiveActivity(activity, activityInitiatorAddress)
            ? t("tokenReceived")
            : t("tokenSent"),
          icon: isReceiveActivity(activity, activityInitiatorAddress) ? (
            <ReceiveIcon style={iconStyle} />
          ) : (
            <SendIcon style={iconStyle} />
          ),
          value: isReceiveActivity(activity, activityInitiatorAddress)
            ? `+${activity.value}`
            : `-${activity.value}`,
        }
      case "asset-approval":
        return {
          ...activity,
          label: t("tokenApproved"),
          icon: <SendIcon style={iconStyle} />,
          value: activity.value,
        }
      case "external-transfer":
        return {
          ...activity,
          icon: isReceiveActivity(activity, activityInitiatorAddress) ? (
            <ReceiveIcon style={iconStyle} />
          ) : (
            <SendIcon style={iconStyle} />
          ),
          label: isReceiveActivity(activity, activityInitiatorAddress)
            ? t("externalReceived")
            : t("externalSend"),
          value: isReceiveActivity(activity, activityInitiatorAddress)
            ? `+${activity.value}`
            : `-${activity.value}`,
        }
      case "contract-deployment":
      case "contract-interaction":
      default:
        return {
          ...activity,
          icon: <ConvertIcon style={iconStyle} />,
          label: t("contractInteraction"),
          value: activity.value,
        }
    }
  }

  const { icon, hash, status, value, label, assetSymbol } =
    quaiActivityTabHandle()

  return (
    <>
      <button
        key={hash}
        className={classNames("quai-activity-item", {
          "activity-in-modal": isInModal,
        })}
        type="button"
        aria-label={hash}
        onClick={() => onClick && onClick()}
      >
        <div
          style={
            isInModal
              ? {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }
              : {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 16px",
                }
          }
        >
          <div className="info-wrapper">
            {icon}
            <div>
              <h4 className="type">{label}</h4>
              <h5
                className={classNames("status", {
                  confirmed: status === TransactionStatus.CONFIRMED,
                  pending: status === TransactionStatus.PENDING,
                  failed: status === TransactionStatus.FAILED,
                })}
              >
                {utxoActivityStatusHandle(status ?? 3)}
              </h5>
            </div>
          </div>
          <div>
            <h4 className="amount-token">
              {value} {assetSymbol}
            </h4>
          </div>
        </div>
      </button>

      <style jsx>{`
        .quai-activity-item {
          transition: background-color 0.1s ease;
          border-radius: 8px;
          margin: 0 8px;
        }

        .quai-activity-item:hover {
          background-color: var(--tertiary-bg);
        }
        .activity-in-modal {
          margin: 0;
          cursor: unset;
        }

        .activity-in-modal:hover {
          background-color: unset;
        }

        .info-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .type {
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          margin: 0;
          color: var(--primary-text);
        }

        .status {
          font-size: 12px;
          font-weight: 500;
          line-height: 18px;
          margin: 0;
        }

        .confirmed {
          color: var(--success-color);
        }

        .pending {
          color: var(--secondary-text);
        }

        .failed {
          color: var(--error-color);
        }

        .amount-token {
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          margin: 0;
          color: var(--primary-text);
        }
      `}</style>
    </>
  )
}
