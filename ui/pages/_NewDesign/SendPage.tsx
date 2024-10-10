import React, { useEffect, useState } from "react"
import { useHistory } from "react-router-dom"
import { selectShowPaymentChannelModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { Zone } from "quais"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import SendAsset from "../../components/_NewDesign/SendAsset/SendAsset"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import PaymentChanelModal from "../../components/_NewDesign/SendAsset/PaymentChanelModal/PaymentChanelModal"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import { useBackgroundSelector } from "../../hooks"

const SendPage = () => {
  const history = useHistory()

  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const utxoAccountsByPaymentCode = useBackgroundSelector(
    (state) => state.account.accountsData.utxo[currentNetwork.chainID]
  )

  const utxoAccountArr = Object.values(utxoAccountsByPaymentCode)

  const showPaymentChannelModal = useBackgroundSelector(
    selectShowPaymentChannelModal
  )
  const [isOpenPaymentChanelModal, setIsOpenPaymentChanelModal] =
    useState(false)

  const { amount, receiverPaymentCode } = useBackgroundSelector(
    (state) => state.qiSend
  )
  const [isConfirmDisabled, setIsConfirmDisabled] = useState(true)

  useEffect(() => {
    if (
      amount &&
      Number(amount) &&
      receiverPaymentCode &&
      receiverPaymentCode.length === 116 &&
      utxoAccountArr[0]?.balances[Zone.Cyprus1]?.assetAmount?.amount &&
      Number(utxoAccountArr[0]?.balances[Zone.Cyprus1]?.assetAmount?.amount) >=
        Number(amount)
    ) {
      setIsConfirmDisabled(false)
      return
    }

    setIsConfirmDisabled(true)
  }, [amount, receiverPaymentCode, utxoAccountArr])

  const handleConfirm = () => {
    if (!showPaymentChannelModal) {
      history.push("/send-qi/confirmation")
    } else {
      setIsOpenPaymentChanelModal(true)
    }
  }

  return (
    <>
      <main className="sendAsset-wrapper">
        <SharedGoBackPageHeader title="Send Assets" linkTo="/" />
        <SendAsset />
        <SharedActionButtons
          title={{ confirmTitle: "Next", cancelTitle: "Cancel" }}
          isConfirmDisabled={isConfirmDisabled}
          onClick={{
            onConfirm: () => handleConfirm(),
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
