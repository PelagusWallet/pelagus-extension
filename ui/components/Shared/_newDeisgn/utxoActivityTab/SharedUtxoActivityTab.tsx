import React, { CSSProperties } from "react"

import classNames from "classnames"
import {
  utxoActivityAmountHandle,
  utxoActivityStatusHandle,
  utxoActivityTypeHandle,
} from "@pelagus/pelagus-background/redux-slices/utils/utxo-activities-utils"
import {
  TransactionStatus,
  UtxoActivityType,
} from "@pelagus/pelagus-background/services/transactions/types"
import ReceiveIcon from "../iconComponents/ReceiveIcon"
import SendIcon from "../iconComponents/SendIcon"
import ConvertIcon from "../iconComponents/ConvertIcon"

const SharedUtxoActivityTab = ({
  style = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "11px 16px",
  },
  type,
  status,
  value,
  activityIconBgColor = "var(--secondary-bg)",
}: {
  style?: CSSProperties
  type: UtxoActivityType
  status: TransactionStatus
  value: number
  activityIconBgColor?: string
}) => {
  const utxoActivityIconHandle = () => {
    const iconStyle = {
      width: "36px",
      height: "36px",
      borderRadius: "50%",
      background: activityIconBgColor,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }
    switch (type) {
      case UtxoActivityType.RECEIVE:
        return <ReceiveIcon style={iconStyle} />
      case UtxoActivityType.SEND:
        return <SendIcon style={iconStyle} />
      case UtxoActivityType.CONVERT:
        return <ConvertIcon style={iconStyle} />
      default:
        return <></>
    }
  }
  return (
    <>
      <div style={style}>
        <div className="info-wrapper">
          {utxoActivityIconHandle()}
          <div>
            <h4 className="type">{utxoActivityTypeHandle(type)}</h4>
            <h5
              className={classNames("status", {
                confirmed: status === TransactionStatus.CONFIRMED,
                pending: status === TransactionStatus.PENDING,
                failed: status === TransactionStatus.FAILED,
              })}
            >
              {utxoActivityStatusHandle(status)}
            </h5>
          </div>
        </div>
        <div>
          <h4 className="amount-token">
            {utxoActivityAmountHandle(value, type)} QI
          </h4>
        </div>
      </div>
      <style jsx>{`
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

export default SharedUtxoActivityTab
