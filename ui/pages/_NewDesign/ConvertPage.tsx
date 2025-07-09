import React, { useState, useRef, useEffect } from "react"
import { useHistory } from "react-router-dom"
import { FaTriangleExclamation, FaCircleExclamation } from "react-icons/fa6"

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
  const [showSlippageWarning, setShowSlippageWarning] = useState(false)
  const scrollableContentRef = useRef<HTMLDivElement>(null)

  const { from, to, amount, expectedSlippage, maxSlippage } =
    useBackgroundSelector((state) => state.convertAssets)

  // Check if expected slippage exceeds max slippage
  // Convert to the same units (percentage with 2 decimal places) before comparing
  const expectedSlippagePercentage = Math.round(expectedSlippage * 10000) / 100
  const maxSlippagePercentage = maxSlippage / 100

  const hasSlippageWarning =
    expectedSlippage > 0 &&
    maxSlippage > 0 &&
    expectedSlippagePercentage > maxSlippagePercentage

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
      Number(amount) < 100 ||
      Number(quaiBalance) < Number(amount)
    )
  }

  const handleConfirm = () => {
    if (hasSlippageWarning && !showSlippageWarning) {
      setShowSlippageWarning(true)
      return
    }

    // Only navigate if no slippage warning
    history.push("/convert/confirmation")
  }

  // Effect to scroll to the bottom when the warning is shown
  useEffect(() => {
    if (showSlippageWarning && scrollableContentRef.current) {
      scrollableContentRef.current.scrollTo({
        top: scrollableContentRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [showSlippageWarning])

  return (
    <>
      <main className="convert-wrapper">
        <div className="header-area">
          <SharedGoBackPageHeader title="Convert Assets" linkTo="/" />
          <div className="disclaimer">
            <FaTriangleExclamation className="warning-icon" /> Native
            conversions are meant for market makers.
          </div>
        </div>

        <div className="scrollable-content" ref={scrollableContentRef}>
          <ConvertAsset />
          {/* Add warning at the bottom of scrollable content */}
          {showSlippageWarning && hasSlippageWarning && (
            <div className="slippage-warning">
              <FaCircleExclamation className="error-icon" />
              <span>
                Increase max slippage to at least{" "}
                {expectedSlippagePercentage.toFixed(2)}% to ensure transaction
                success.
              </span>
            </div>
          )}
        </div>

        <div className="footer-area">
          <SharedActionButtons
            title={{ confirmTitle: "Next", cancelTitle: "Cancel" }}
            onClick={{
              onConfirm: () => handleConfirm(),
              onCancel: () => {
                setShowSlippageWarning(false)
                history.push("/")
              },
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
          scrollbar-width: thin;
          scrollbar-color: var(--secondary-text) transparent;
        }

        .scrollable-content::-webkit-scrollbar {
          width: 6px;
        }

        .scrollable-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollable-content::-webkit-scrollbar-thumb {
          background-color: var(--secondary-text);
          border-radius: 3px;
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
          color:rgb(254, 200, 64);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }

        .warning-icon {
          color: #896404;
          font-size: 16px;
        }

        .slippage-warning {
          margin: 16px 0;
          padding: 8px 12px;
          background-color: #ffebee;
          border-radius: 8px;
          font-size: 14px;
          color: #f44336;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .error-icon {
          color: #f44336;
          font-size: 18px;
          flex-shrink: 0;
        }
      `}</style>
    </>
  )
}

export default ConvertPage
