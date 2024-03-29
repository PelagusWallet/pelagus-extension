import { selectMainCurrencySymbol } from "@pelagus/pelagus-background/redux-slices/selectors"
import { formatCurrencyAmount } from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import React, { ReactElement } from "react"
import { useBackgroundSelector } from "../../hooks"
import SharedAddress from "../Shared/SharedAddress"

export default function AccountItem({
  name,
  address,
  percent,
  total,
}: {
  name: string
  address: string
  percent: number
  total: number
}): ReactElement {
  const mainCurrencySymbol = useBackgroundSelector(selectMainCurrencySymbol)
  const balance = formatCurrencyAmount(mainCurrencySymbol, total, 2)
  const percentText = `${percent}%`
  return (
    <>
      <div className="account_item">
        <SharedAddress address={address} name={name} elide />
        <span className="account_value ellipsis" title={percentText}>
          {percentText}
        </span>
        <span className="account_value ellipsis" title={`$${balance}`}>
          ${balance}
        </span>
      </div>
      <style jsx>{`
        .account_item {
          background: var(--green-95);
          border-radius: 2px;
          color: var(--green-20);
          font-size: 16px;
          font-weight: 500;
          line-height: 24px;
          text-align: right;
          margin-top: 8px;
          padding: 2px 6px;
          display: flex;
        }
        .account_item > :global(:nth-child(1)) {
          width: 45%;
          text-align: left;
        }
        .account_value:nth-child(2) {
          width: 15%;
        }
        .account_value:nth-child(3) {
          width: 40%;
          padding-left: 10px;
        }
        .account_name {
          text-align: left;
          color: var(--green-40);
        }
      `}</style>
    </>
  )
}
