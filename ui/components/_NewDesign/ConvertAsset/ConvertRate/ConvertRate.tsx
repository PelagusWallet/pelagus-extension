import React, { useEffect, useState } from "react"
import { setConvertRateHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"
import { formatQuai, formatQi, parseQi, parseQuai } from "quais"

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
      return
    } else {
      setFromAsset("QUAI")
      setToAsset("QI")
      setFormattedRate(rate.toFixed(3))
    }
  }, [rate])

  if (!convertFromAccount) return <></>


  return (
    <>
      <h5 className="rate">
        1 {fromAsset} ≈ {formattedRate} {toAsset}
      </h5>
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

export default ConvertRate
