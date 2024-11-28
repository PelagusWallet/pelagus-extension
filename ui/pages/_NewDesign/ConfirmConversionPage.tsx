import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import { convertAssetsHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import { useBackgroundDispatch } from "../../hooks"
import ConfirmConversion from "../../components/_NewDesign/ConfirmConversion/ConfirmConversion"
import { useTranslation } from "react-i18next"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"

const ConfirmConversionPage = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()

  const [isConfirmLoading, setIsConfirmLoading] = useState(false)
  const [isOpenConfirmationModal, setIsOpenConfirmationModal] = useState(false)

  const { t: confirmationLocales } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation",
  })

  const handleConfirm = async () => {
    setIsConfirmLoading(true)
    dispatch(convertAssetsHandle())
    setTimeout(() => {
      setIsConfirmLoading(false)
      setIsOpenConfirmationModal(true)
    }, 2000)
  }

  const confirmationModalProps = {
    headerTitle: confirmationLocales("send.headerTitle", {
      network: "",
    }),
    title: confirmationLocales("send.title"),
    isOpen: isOpenConfirmationModal,
    onClose: () => history.push("/"),
  }

  return (
    <>
      <main className="convert-confirmation-wrapper">
        <SharedGoBackPageHeader title="Confirm Conversion" />
        <ConfirmConversion />
        <SharedActionButtons
          title={{ confirmTitle: "Convert", cancelTitle: "Back" }}
          onClick={{
            onConfirm: () => handleConfirm(),
            onCancel: () => history.push("-1"),
          }}
          isLoading={isConfirmLoading}
        />
      </main>

      <SharedConfirmationModal
        headerTitle={confirmationModalProps.headerTitle}
        title={confirmationModalProps.title}
        isOpen={confirmationModalProps.isOpen}
        onClose={confirmationModalProps.onClose}
      />

      <style jsx>{`
        .convert-confirmation-wrapper {
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

export default ConfirmConversionPage
