import React, { useEffect, useState } from "react"
import { useBackgroundSelector } from "../../../../hooks"

const ConvertSlippage = () => {
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
    setFormattedSlippage(expectedSlippage.toFixed(2))
  }, [expectedSlippage, amount, convertFromAccount])

  if (
    !amount ||
    (expectedSlippage && Number((expectedSlippage ?? 0).toFixed(2)) === 0)
  ) {
    return <></>
  }

  return (
    <>
      <h5 className="rate">{formattedSlippage}% slippage</h5>
      <style jsx>{`
        .rate {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          text-align: center;
          color: var(--secondary-text);
        }
      `}</style>
    </>
  )
}

export default ConvertSlippage
