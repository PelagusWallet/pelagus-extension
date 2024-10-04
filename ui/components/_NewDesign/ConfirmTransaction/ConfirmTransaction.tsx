import React from "react"
import FeeSettings from "./FeeSettings/FeeSettings"
import QuaiAccount from "./QuaiAccount/QuaiAccount"
import TransactionDetails from "./TransactionDetails/TransactionDetails"

const ConfirmTransaction = () => {
  return (
    <>
      <TransactionDetails />
      <QuaiAccount />
      <FeeSettings />
    </>
  )
}

export default ConfirmTransaction
