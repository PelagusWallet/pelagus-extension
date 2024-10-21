import React from "react"
import { useBackgroundSelector } from "../../../../hooks"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"
import SharedLoadingSpinner from "../../../Shared/SharedLoadingSpinner"

const ConvertToAmount = () => {
  const convertToAccount = useBackgroundSelector(
    (state) => state.convertAssets.to
  )

  const amount = useBackgroundSelector((state) => state.convertAssets.amount)
  const rate = useBackgroundSelector((state) => state.convertAssets.rate)

  const tokenLabelHandle = () => {
    if (convertToAccount && isUtxoAccountTypeGuard(convertToAccount)) {
      return "QI"
    }

    return "QUAI"
  }

  const receiveAmountHandle = () => {
    if (!rate || isNaN(Number(amount))) {
      return <SharedLoadingSpinner size="small" />
    }

    return (Number(amount) * rate).toFixed(4)
  }

  return (
    <>
      <div className="receive-wrapper">
        <h3 className="receive-value">{receiveAmountHandle()} </h3>
        <h3 className="receive-token">{tokenLabelHandle()}</h3>
      </div>

      <style jsx>{`
        .receive-wrapper {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--primary-text);
          padding: 16px;
          background: var(--secondary-bg);
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .receive-value,
        .receive-token {
          font-size: 20px;
          font-weight: 500;
          line-height: 30px;
          margin: 0;
        }

        .receive-value {
          max-width: 270px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .receive-token {
          color: var(--secondary-text);
        }
      `}</style>
    </>
  )
}

export default ConvertToAmount
