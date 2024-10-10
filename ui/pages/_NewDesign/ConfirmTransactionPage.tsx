import React, { useEffect, useState } from "react"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { useHistory } from "react-router-dom"
import { sendQiTransaction } from "@pelagus/pelagus-background/redux-slices/qiSend"
import { useTranslation } from "react-i18next"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import AccountsNotificationPanel from "../../components/AccountsNotificationPanel/AccountsNotificationPanel"
import ConfirmTransaction from "../../components/_NewDesign/ConfirmTransaction/ConfirmTransaction"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"

const ConfirmTransactionPage = () => {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()

  const { t: confirmationLocales } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation",
  })

  const { senderQuaiAccount } = useBackgroundSelector((state) => state.qiSend)
  const { balance: quaiBalance = "" } = senderQuaiAccount ?? {}

  const [isInsufficientQuai, setInsufficientQuai] = useState(false)
  const [isOpenConfirmationModal, setIsOpenConfirmationModal] = useState(false)
  const [isTransactionError, setIsTransactionError] = useState(false)

  useEffect(() => {
    const serializedBalance = Number(quaiBalance.split(" ")[0])

    if (senderQuaiAccount && !serializedBalance) {
      setInsufficientQuai(true)
      return
    }
    setInsufficientQuai(false)
  }, [quaiBalance, senderQuaiAccount])

  const onSendQiTransaction = async () => {
    if (isInsufficientQuai) return

    dispatch(sendQiTransaction())
    setIsOpenConfirmationModal(true)
  }

  const confirmationModalProps = isTransactionError
    ? {
        headerTitle: confirmationLocales("send.errorHeadline"),
        subtitle: confirmationLocales("send.errorSubtitle"),
        title: `${confirmationLocales("send.errorTitle")}!`,
        icon: {
          src: "icons/s/notif-wrong.svg",
          height: "43",
          width: "43",
          color: "var(--error-color)",
          padding: "32px",
        },
        isOpen: isOpenConfirmationModal,
        onClose: () => history.push("/"),
      }
    : {
        headerTitle: confirmationLocales("send.headerTitle", {
          network: "",
        }),
        title: confirmationLocales("send.title"),
        isOpen: isOpenConfirmationModal,
        onClose: () => history.push("/"),
      }

  return (
    <>
      <main className="confirm-transaction-wrapper">
        <SharedGoBackPageHeader title="Confirm Transaction" />
        <ConfirmTransaction isInsufficientQuai={isInsufficientQuai} />
        <SharedActionButtons
          title={{ confirmTitle: "Send", cancelTitle: "Back" }}
          isConfirmDisabled={!senderQuaiAccount || isInsufficientQuai}
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
      <SharedConfirmationModal
        headerTitle={confirmationModalProps.headerTitle}
        title={confirmationModalProps.title}
        subtitle={confirmationModalProps.subtitle}
        isOpen={confirmationModalProps.isOpen}
        onClose={confirmationModalProps.onClose}
        icon={confirmationModalProps.icon}
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
