import React from "react"
import { UtxoAccountData } from "@pelagus/pelagus-background/redux-slices/accounts"
import { AccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import { useBackgroundSelector } from "../../../../hooks"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"

const ConfirmConversionDetails = () => {
  const { from, to, amount, expectedResult, maxSlippage } = useBackgroundSelector(
    (state) => state.convertAssets
  )

  const tokenSymbolHandle = (
    account: UtxoAccountData | AccountTotal | null
  ) => {
    if (!account) {
      return ""
    }
    if (isUtxoAccountTypeGuard(account)) {
      return "QI"
    }

    return "QUAI"
  }

  const receiveAmountHandle = () => {
    if (!expectedResult || Number.isNaN(Number(amount))) {
      return ""
    }

    if (to && isUtxoAccountTypeGuard(to)) {
      return expectedResult.toFixed(3)
    }

    return expectedResult.toFixed(4)
  }

  return (
    <>
      <div className="details-wrapper">
        <div className="details-row">
          <p className="details-row-key">Convert</p>
          <p className="details-row-value">
            {Number(amount).toFixed(4)} {tokenSymbolHandle(from)}
          </p>
        </div>
        <div className="details-row">
          <p className="details-row-key">Receive</p>
          <p className="details-row-value">
            {receiveAmountHandle()} {tokenSymbolHandle(to)}
          </p>
        </div>
        <div className="details-row">
          <p className="details-row-key">Max Slippage</p>
          <p className="details-row-value">
            {(maxSlippage / 100).toFixed(2)}%
          </p>
        </div>
      </div>
      <style jsx>{`
        .details-wrapper {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
          background: var(--secondary-bg);
          border-radius: 8px;
        }

        .details-row {
          display: flex;
          justify-content: space-between;
        }

        .details-row-key {
          margin: 0;
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          color: var(--secondary-text);
        }

        .details-row-value {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--primary-text);
        }
      `}</style>
    </>
  )
}

export default ConfirmConversionDetails
