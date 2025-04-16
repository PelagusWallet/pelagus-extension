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
        Number(amount) < 100 ||
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
        <div className="header-area">
          <SharedGoBackPageHeader title="Convert Assets" linkTo="/" />
          <div className="disclaimer">
            Native convertions are meant for market makers.
          </div>
        </div>

        <div className="scrollable-content">
          <ConvertAsset />
        </div>

        <div className="footer-area">
          <SharedActionButtons
            title={{ confirmTitle: "Next", cancelTitle: "Cancel" }}
            onClick={{
              onConfirm: () => handleConfirm(),
              onCancel: () => history.push("/"),
            }}
            isConfirmDisabled={isDisabledHandle()}
          />
        </div>
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
          display: flex;
          flex-direction: column;
        }

        .header-area {
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--primary-bg);
          padding: 16px 16px 0;
        }

        .scrollable-content {
          flex: 1;
          overflow-y: auto;
          padding: 0 16px;
          margin-bottom: 80px; /* Space for the buttons */
        }

        .footer-area {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--primary-bg);
          padding: 16px;
          z-index: 10;
        }

        .disclaimer {
          margin: -15px 0 5px 0;
          padding: 8px;
          background-color: rgba(255, 246, 214, 0.5);
          border-radius: 8px;
          font-size: 14px;
          text-align: center;
          color: #896404;
        }
      `}</style>
    </>
  )
}

export default ConvertPage
