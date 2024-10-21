import React from "react"
import { useHistory } from "react-router-dom"

import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import ConvertAsset from "../../components/_NewDesign/ConvertAsset/ConvertAsset"
import AccountsNotificationPanel from "../../components/AccountsNotificationPanel/AccountsNotificationPanel"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { useBackgroundDispatch } from "../../hooks"

const ConvertPage = () => {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()

  const handleConfirm = () => {
    history.push("/convert/confirmation")
  }

  return (
    <>
      <main className="convert-wrapper">
        <SharedGoBackPageHeader title="Convert Assets" linkTo="/" />
        <ConvertAsset />
        <SharedActionButtons
          title={{ confirmTitle: "Next", cancelTitle: "Cancel" }}
          onClick={{
            onConfirm: () => handleConfirm(),
            onCancel: () => history.push("/"),
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
        .convert-wrapper {
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

export default ConvertPage
