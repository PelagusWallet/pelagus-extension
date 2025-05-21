import React from "react"
import { useBackgroundSelector } from "../../../hooks"
import { trimWithEllipsis } from "../../../utils/textUtils"

const ConfirmWrapAmount = () => {
  const { amount, rate } = useBackgroundSelector((state) => state.convertAssets)

  return (
    <>
      <div className="amount-wrapper">
        <h5 className="type">Wrapping</h5>
        <h2 className="amount">
          {trimWithEllipsis(amount, 8)} QI to WQI
        </h2>
        <h5 className="rate">
          1 QI = 1 WQI
        </h5>
      </div>
      <style jsx>{`
        .amount-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin-bottom: 24px;
        }

        .amount {
          margin: 0;
          font-size: 32px;
          font-weight: 500;
          line-height: 38px;
          color: var(--primary-text);
        }

        .type,
        .rate {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--secondary-text);
        }
      `}</style>
    </>
  )
}

export default ConfirmWrapAmount 