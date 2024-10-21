import React from "react"
import ConfirmConversionAmount from "./ConfirmConversionAmount/ConfirmConversionAmount"
import ConfirmConversionDestination from "./ConfirmConversionDestination/ConfirmConversionDestination"
import ConfirmConversionDetails from "./ConfirmConversionDetails/ConfirmConversionDetails"
import ConfirmConversionWarning from "./ConfirmConversionWarning/ConfirmConversionWarning"

const ConfirmConversion = () => {
  return (
    <>
      <ConfirmConversionWarning />
      <ConfirmConversionAmount />
      <ConfirmConversionDestination />
      <ConfirmConversionDetails />
    </>
  )
}

export default ConfirmConversion
