import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useBackgroundSelector } from "../../../../hooks"

const ConvertSlippage = () => {
  const { t } = useTranslation()
  const expectedSlippage = useBackgroundSelector(
    (state) => state.convertAssets.expectedSlippage
  )
  const amount = useBackgroundSelector((state) => state.convertAssets.amount)
  const convertFromAccount = useBackgroundSelector(
    (state) => state.convertAssets.from
  )

  const [formattedSlippage, setFormattedSlippage] = useState("")

  useEffect(() => {
    if (!convertFromAccount || !amount) return
    if (Number(amount) === 0) return
    setFormattedSlippage((expectedSlippage * 100).toFixed(2))
  }, [expectedSlippage, amount, convertFromAccount])

  if (
    !amount ||
    (expectedSlippage && Number((expectedSlippage * 100).toFixed(2)) === 0)
  ) {
    return <></>
  }

  return (
    <>
      <div className="slippage-container">
        <span className="slippage-label">{t("convert_slippage.estimated_slippage")}</span>
        <span className="slippage-value">{formattedSlippage}%</span>
      </div>
      <style jsx>{`
        .slippage-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 12px 0;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--secondary-text);
        }

        .slippage-label {
          color: var(--secondary-text);
        }

        .slippage-value {
          color: var(--secondary-text);
        }
      `}</style>
    </>
  )
}

export default ConvertSlippage
