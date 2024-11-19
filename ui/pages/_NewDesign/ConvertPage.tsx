import React from "react"
import { useHistory } from "react-router-dom"

import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { parseQi, Zone } from "quais"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import ConvertAsset from "../../components/_NewDesign/ConvertAsset/ConvertAsset"
import AccountsNotificationPanel from "../../components/AccountsNotificationPanel/AccountsNotificationPanel"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { isUtxoAccountTypeGuard } from "../../utils/accounts"

const ConvertPage = () => {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()

  const handleConfirm = () => {
    history.push("/convert/confirmation")
  }

  const { from, to, amount } = useBackgroundSelector(
    (state) => state.convertAssets
  )

  const isDisabledHandle = () => {
    if (!from || !to || !amount) return true

    if (isUtxoAccountTypeGuard(from)) {
      return (
        Number(amount) < 10 ||
        !from?.balances[Zone.Cyprus1]?.assetAmount?.amount ||
        from?.balances[Zone.Cyprus1]?.assetAmount?.amount < parseQi(amount)
      )
    }

    const quaiBalance = from?.balance?.split(" ")[0]
    return (
      !quaiBalance ||
      Number(amount) < 10 ||
      Number(quaiBalance) < Number(amount)
    )
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
          isConfirmDisabled={isDisabledHandle()}
        />
      </main>

      <AccountsNotificationPanel
        onCurrentAddressChange={() => dispatch(setShowingAccountsModal(false))}
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
