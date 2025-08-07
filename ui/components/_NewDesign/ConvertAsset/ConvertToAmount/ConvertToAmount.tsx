import React from "react"
import { useBackgroundSelector } from "../../../../hooks"
import { isUtxoAccountTypeGuard } from "@pelagus/pelagus-ui/utils/accounts"
import SharedLoadingSpinner from "../../../Shared/SharedLoadingSpinner"

const ConvertToAmount = () => {
  const convertToAccount = useBackgroundSelector(
    (state) => state.convertAssets.to
  )

  const amount = useBackgroundSelector((state) => state.convertAssets.amount)
  const expectedResult = useBackgroundSelector(
    (state) => state.convertAssets.expectedResult
  )

  const tokenLabelHandle = () => {
    const convertingToUtxoAccount =
      convertToAccount && isUtxoAccountTypeGuard(convertToAccount)
    if (convertingToUtxoAccount) {
      return "QI"
    }
    return "QUAI"
  }

  const receiveAmountHandle = () => {
    const convertingToUtxoAccount =
      convertToAccount && isUtxoAccountTypeGuard(convertToAccount)

    if (!amount) {
      return convertingToUtxoAccount ? "0.000" : "0.0000"
    }
    if (!expectedResult || Number.isNaN(Number(expectedResult))) {
      return <SharedLoadingSpinner size="small" />
    }

    if (convertingToUtxoAccount) {
      return expectedResult.toFixed(3)
    }
    return convertingToUtxoAccount
      ? expectedResult.toFixed(3)
      : expectedResult.toFixed(4)
  }

  return (
    <>
      <div className="receive-wrapper">
        <h3 className="receive-value">{receiveAmountHandle()}</h3>
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
