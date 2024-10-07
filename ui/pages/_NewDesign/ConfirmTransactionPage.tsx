import React, { useEffect, useState } from "react"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { useHistory } from "react-router-dom"
import { sendQiTransaction } from "@pelagus/pelagus-background/redux-slices/qiSend"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import AccountsNotificationPanel from "../../components/AccountsNotificationPanel/AccountsNotificationPanel"
import ConfirmTransaction from "../../components/_NewDesign/ConfirmTransaction/ConfirmTransaction"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"

const ConfirmTransactionPage = () => {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()

  const { senderQuaiAccount } = useBackgroundSelector((state) => state.qiSend)
  const { balance: quaiBalance = "" } = senderQuaiAccount ?? {}

  const [isInsufficientQuai, setInsufficientQuai] = useState(false)

  useEffect(() => {
    const serializedBalance = Number(quaiBalance.split(" ")[0])

    if (!serializedBalance) {
      setInsufficientQuai(true)
      return
    }
    setInsufficientQuai(false)
  }, [quaiBalance])

  const onSendQiTransaction = async () => {
    if (isInsufficientQuai) return
    await dispatch(sendQiTransaction())
  }

  return (
    <>
      <main className="confirm-transaction-wrapper">
        <SharedGoBackPageHeader title="Confirm Transaction" />
        <ConfirmTransaction isInsufficientQuai={isInsufficientQuai} />
        <SharedActionButtons
          title={{ confirmTitle: "Send", cancelTitle: "Back" }}
          isConfirmDisabled={isInsufficientQuai}
          onClick={{
            onConfirm: onSendQiTransaction,
            onCancel: () => history.push("-1"),
          }}
        />
      </main>

      <AccountsNotificationPanel
        onCurrentAddressChange={() => dispatch(setShowingAccountsModal(false))}
        setSelectedAccountSigner={() => {}}
        selectedAccountSigner=""
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
