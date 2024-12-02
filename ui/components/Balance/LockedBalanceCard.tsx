import React, { ReactElement } from "react"

interface LockedBalanceCardProps {
  balance: string
  assetSymbol: string
}

export default function LockedBalanceCard({
  balance,
  assetSymbol,
}: LockedBalanceCardProps): ReactElement {
  return (
    <div className="locked-balance-card">
      <div className="icon" />
      <span className="balance">{balance} {assetSymbol} Locked</span>
      <style jsx>{`
        .locked-balance-card {
          color: #19191a;
          background-color: #efefef;
          border-radius: 8px;
          padding: 10px;
          width: 200px;
          height: 20px;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
        }
        .icon {
          mask: url("./images/balance_lock.svg") center / contain no-repeat;
          width: 20px;
          height: 21px;
          background-color: #96969b;
          margin-right: 12px;
        }
        .balance {
          font-size: 14px;
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}
