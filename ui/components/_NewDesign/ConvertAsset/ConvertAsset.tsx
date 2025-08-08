import React from "react"
import ConvertFrom from "./ConvertFrom/ConvertFrom"
import ConvertTo from "./ConvertTo/ConvertTo"
import ConvertFromAmount from "./ConvertFromAmount/ConvertFromAmount"
import ConvertToAmount from "./ConvertToAmount/ConvertToAmount"
import ConvertRate from "./ConvertRate/ConvertRate"
import ConvertSlippage from "./ConvertSlippage/ConvertSlippage"
import MaxSlippageSelector from "./MaxSlippageSelector/MaxSlippageSelector"
import IntervalSettings from "./IntervalSettings/IntervalSettings"

const ConvertAsset = () => {
  return (
    <>
      <ConvertFrom />
      <ConvertFromAmount />
      <ConvertTo />
      <ConvertToAmount />
      <ConvertRate />
      <ConvertSlippage />
      <MaxSlippageSelector />
      <IntervalSettings />
    </>
  )
}

export default ConvertAsset
