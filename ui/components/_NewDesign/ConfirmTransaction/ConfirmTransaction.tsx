import React from "react"
import FeeSettings from "./FeeSettings/FeeSettings"
import QuaiAccount from "./QuaiAccount/QuaiAccount"
import TransactionDetails from "./TransactionDetails/TransactionDetails"
import SharedErrorLabel from "../../Shared/_newDeisgn/errorLabel/SharedErrorLabel"

const ConfirmTransaction = ({
  isInsufficientQuai,
}: {
  isInsufficientQuai: boolean
}) => {
  return (
    <>
      <TransactionDetails />
      <QuaiAccount />
      {isInsufficientQuai && (
        <SharedErrorLabel title="Insufficient funds to process transaction" />
      )}
      <FeeSettings />
    </>
  )
}

export default ConfirmTransaction
