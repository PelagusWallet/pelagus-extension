import React from "react"
import { useTranslation } from "react-i18next"
import {
  selectShowingAddAccountModal,
  selectShowingImportPrivateKeyModal,
  setImportPrivateKeyModalCategory,
  setShowingAddAccountModal,
  setShowingImportPrivateKeyModal,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../hooks"
import SharedModalWrapper from "../../Shared/_newDeisgn/modalWrapper/SharedModalWrapper"
import SharedModalHeaders from "../../Shared/_newDeisgn/modalWrapper/SharedModalHeaders"
import SharedCancelButton from "../../Shared/_newDeisgn/actionButtons/SharedCancelButton"
import DeriveAddress from "./DeriveAddress/DeriveAddress"
import { AccountCategoriesEnum } from "../../../utils/enum/accountsEnum"
import ImportPrivateKey from "./ImportPrivateKey/ImportPrivateKey"

const ImportAccount = ({
  accountCategory,
}: {
  accountCategory: AccountCategoriesEnum
}) => {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()

  const isShowingAddAccountModal = useBackgroundSelector(
    selectShowingAddAccountModal
  )
  const isShowingImportPrivateKeyModal = useBackgroundSelector(
    selectShowingImportPrivateKeyModal
  )

  const onClose = async () => {
    await dispatch(setShowingAddAccountModal(false))
    await dispatch(setShowingImportPrivateKeyModal(false))
  }

  const onBack = async () => {
    if (isShowingImportPrivateKeyModal) {
      await dispatch(setShowingImportPrivateKeyModal(false))
      await dispatch(setShowingAddAccountModal(true))
      return
    }
    await onClose()
  }

  const goToImportPrivateKey = async () => {
    await dispatch(setImportPrivateKeyModalCategory(accountCategory))
    await dispatch(setShowingImportPrivateKeyModal(true))
    await dispatch(setShowingAddAccountModal(false))
  }

  const modalTitleHandler = () => {
    if (isShowingImportPrivateKeyModal) return t("topMenu.importFromPrivateKey")

    return t("topMenu.addQuaiAccountTitle")
  }

  if (!isShowingAddAccountModal && !isShowingImportPrivateKeyModal) return <></>

  return (
    <>
      {isShowingAddAccountModal ? (
        <SharedModalWrapper
          customStyles={{ alignItems: "flex-end" }}
          header={
            <SharedModalHeaders title={modalTitleHandler()} onClose={onClose} />
          }
          footer={
            <SharedCancelButton
              title={t("topMenu.importFromPrivateKey")}
              onClick={goToImportPrivateKey}
            />
          }
          onClose={onClose}
          isOpen={isShowingAddAccountModal}
        >
          <DeriveAddress />
        </SharedModalWrapper>
      ) : (
        <SharedModalWrapper
          customStyles={{ alignItems: "flex-end" }}
          header={
            <SharedModalHeaders
              title={modalTitleHandler()}
              onClose={onClose}
              onBack={onBack}
            />
          }
          footer={<></>}
          onClose={onClose}
          isOpen={isShowingImportPrivateKeyModal}
        >
          <ImportPrivateKey />
        </SharedModalWrapper>
      )}
    </>
  )
}

export default ImportAccount
