import React from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  const { channelExists } = useBackgroundSelector((state) => state.qiSend)

  return (
    <>
      <TransactionDetails />
      {!channelExists && (
        <>
          <QuaiAccount />
          {isInsufficientQuai && (
            <SharedErrorLabel title={t("common.insufficientFunds")} />
          )}
        </>
      )}

      <FeeSettings />
    </>
  )
}

export default ConfirmTransaction
