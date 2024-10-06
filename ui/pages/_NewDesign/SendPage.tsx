import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import SendAsset from "../../components/_NewDesign/SendAsset/SendAsset"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import PaymentChanelModal from "../../components/_NewDesign/SendAsset/PaymentChanelModal/PaymentChanelModal"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"

const SendPage = () => {
  const history = useHistory()

  const [isOpenPaymentChanelModal, setIsOpenPaymentChanelModal] =
    useState(false)

  return (
    <>
      <main className="sendAsset-wrapper">
        <SharedGoBackPageHeader title="SendPage Assets" linkTo="/" />
        <SendAsset />
        <SharedActionButtons
          title={{ confirmTitle: "Next", cancelTitle: "Cancel" }}
          onClick={{
            onConfirm: () => setIsOpenPaymentChanelModal(true),
            onCancel: () => history.push("/"),
          }}
        />
      </main>
      {isOpenPaymentChanelModal && (
        <PaymentChanelModal
          setIsOpenPaymentChanelModal={setIsOpenPaymentChanelModal}
        />
      )}
      <style jsx>{`
        .sendAsset-wrapper {
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

export default SendPage
