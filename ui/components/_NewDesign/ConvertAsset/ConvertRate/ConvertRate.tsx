import React, { useEffect } from "react"
import { setConvertRateHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"

const ConvertRate = () => {
  const dispatch = useBackgroundDispatch()
  const rate = useBackgroundSelector((state) => state.convertAssets.rate)
  const convertFromAccount = useBackgroundSelector(
    (state) => state.convertAssets.from
  )

  useEffect(() => {
    dispatch(setConvertRateHandle())
  }, [])

  if (!convertFromAccount) return <></>

  return (
    <>
      <h5 className="rate">
        1 {isUtxoAccountTypeGuard(convertFromAccount) ? "QI" : "QUAI"} = {rate}{" "}
        {isUtxoAccountTypeGuard(convertFromAccount) ? "QUAI" : "QI"}
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
