import React from "react"

const UtxoActivityInfo = ({ value }: { value: number }) => {
  return (
    <>
      <div>
        <h4 className="activity-info-title">Transaction</h4>
        <div className="amount-wrapper">
          <h5 className="amount-title">Amount</h5>
          <h5 className="amount-value">{value} QI</h5>
        </div>
      </div>
      <style jsx>{`
        .activity-info-title,
        .amount-value {
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--primary-text);
          margin: 0 0 8px;
        }

        .amount-value {
          margin: 0;
        }

        .amount-wrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .amount-title {
          font-size: 12px;
          font-weight: 500;
          line-height: 18px;
          color: var(--secondary-text);
          margin: 0;
        }
      `}</style>
    </>
  )
}

export default UtxoActivityInfo
