import React from "react"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { useHistory } from "react-router-dom"
import { sendQiTransaction } from "@pelagus/pelagus-background/redux-slices/qiSend"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { useBackgroundDispatch } from "../../hooks"
import AccountsNotificationPanel from "../../components/AccountsNotificationPanel/AccountsNotificationPanel"
import ConfirmTransaction from "../../components/_NewDesign/ConfirmTransaction/ConfirmTransaction"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"

const ConfirmTransactionPage = () => {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()

  const onSendQiTransaction = async () => {
    await dispatch(sendQiTransaction())
  }

  return (
    <>
      <main className="confirm-transaction-wrapper">
        <SharedGoBackPageHeader title="Confirm Transaction" />
        <ConfirmTransaction />
        <SharedActionButtons
          title={{ confirmTitle: "Send", cancelTitle: "Back" }}
          onClick={{
            onConfirm: onSendQiTransaction,
            onCancel: () => history.push("-1"),
          }}
        />
      </main>

      <AccountsNotificationPanel
        onCurrentAddressChange={() => dispatch(setShowingAccountsModal(false))}
        setSelectedAccountSigner={() => {}}
        selectedAccountSigner={""}
        isNeedToChangeAccount={false}
      />
      <style jsx>{`
        .confirm-transaction-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: 16px;
        }
      `}</style>
    </>
  )
}

export default ConfirmTransactionPage
