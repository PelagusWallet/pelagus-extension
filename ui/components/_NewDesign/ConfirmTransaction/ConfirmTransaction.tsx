import React from "react"
import FeeSettings from "./FeeSettings/FeeSettings"
import QuaiAccount from "./QuaiAccount/QuaiAccount"
import TransactionDetails from "./TransactionDetails/TransactionDetails"
import SharedErrorLabel from "../../Shared/_newDeisgn/errorLabel/SharedErrorLabel"
import { useBackgroundSelector } from "../../../hooks"

const ConfirmTransaction = ({
  isInsufficientQuai,
}: {
  isInsufficientQuai: boolean
}) => {
  const { channelExists } = useBackgroundSelector((state) => state.qiSend)

  return (
    <>
      <TransactionDetails />
      {!channelExists && (
        <>
          <QuaiAccount />
          {isInsufficientQuai && (
            <SharedErrorLabel title="Insufficient funds to process transaction" />
          )}
        </>
      )}

      <FeeSettings />
    </>
  )
}

export default ConfirmTransaction
