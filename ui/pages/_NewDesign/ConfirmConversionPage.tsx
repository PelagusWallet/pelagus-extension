import React from "react"
import { useHistory } from "react-router-dom"
import { convertAssetsHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import { useBackgroundDispatch } from "../../hooks"
import ConfirmConversion from "../../components/_NewDesign/ConfirmConversion/ConfirmConversion"

const ConfirmConversionPage = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()

  const handleConfirm = async () => {
    await dispatch(convertAssetsHandle())
    history.push("/")
  }

  return (
    <>
      <main className="convert-confirmation-wrapper">
        <SharedGoBackPageHeader title="Confirm Conversion" />
        <ConfirmConversion />
        <SharedActionButtons
          title={{ confirmTitle: "Send", cancelTitle: "Back" }}
          onClick={{
            onConfirm: () => handleConfirm(),
            onCancel: () => history.push("-1"),
          }}
        />
      </main>

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
