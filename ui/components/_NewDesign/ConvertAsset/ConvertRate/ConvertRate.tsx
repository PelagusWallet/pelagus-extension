import React, { useEffect, useState } from "react"
import { setConvertRateHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"

const ConvertRate = () => {
  const dispatch = useBackgroundDispatch()
  const rate = useBackgroundSelector((state) => state.convertAssets.rate)
  const convertFromAccount = useBackgroundSelector(
    (state) => state.convertAssets.from
  )

  const [formattedRate, setFormattedRate] = useState("")
  const [fromAsset, setFromAsset] = useState("")
  const [toAsset, setToAsset] = useState("")

  useEffect(() => {
    dispatch(setConvertRateHandle())
  }, [])

  useEffect(() => {
    if (!convertFromAccount) return
    const convertingFromUtxoAccount = isUtxoAccountTypeGuard(convertFromAccount)
    if (convertingFromUtxoAccount) {
      setFromAsset("QI")
      setToAsset("QUAI")
      setFormattedRate(rate.toFixed(4))
    } else {
      setFromAsset("QUAI")
      setToAsset("QI")
      setFormattedRate(rate.toFixed(3))
    }
  }, [rate, convertFromAccount])

  if (!convertFromAccount) return <></>

  return (
    <>
      <div className="rate-container">
        <span className="rate-label">Market rate</span>
        <span className="rate-value">
          1 {fromAsset} ≈ {formattedRate} {toAsset}
        </span>
      </div>
      <style jsx>{`
        .rate-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 12px 0;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--secondary-text);
        }

        .rate-label {
          color: var(--secondary-text);
        }

        .rate-value {
          color: var(--secondary-text);
        }
      `}</style>
    </>
  )
}

export default ConvertRate
