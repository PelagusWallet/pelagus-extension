import React from "react"
import { AccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import { UtxoAccountData } from "@pelagus/pelagus-background/redux-slices/accounts"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"
import { useBackgroundSelector } from "../../../../hooks"
import { trimWithEllipsis } from "../../../../utils/textUtils"

const ConfirmConversionAmount = () => {
  const { from, to, amount, rate } = useBackgroundSelector(
    (state) => state.convertAssets
  )

  const tokenSymbolHandler = (
    account: UtxoAccountData | AccountTotal | null
  ) => {
    if (!account) return ""

    if (isUtxoAccountTypeGuard(account)) {
      return "QI"
    }

    return "QUAI"
  }

  return (
    <>
      <div className="amount-wrapper">
        <h5 className="type">Converting</h5>
        <h2 className="amount">
          {trimWithEllipsis(amount, 8)} {tokenSymbolHandler(from)} to{" "}
          {tokenSymbolHandler(to)}
        </h2>
        <h5 className="rate">
          1 {tokenSymbolHandler(from)} = {rate} {tokenSymbolHandler(to)}
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

export default ConfirmConversionAmount
