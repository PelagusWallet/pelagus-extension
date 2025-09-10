import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useHistory, useLocation } from "react-router-dom"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { formatQi, Zone } from "quais"
import { isAccountTotalTypeGuard, isUtxoAccountTypeGuard } from "../../utils/accounts"
import { getWrappedQiDepositHandle, wrapQiHandle, setConvertFrom, setConvertAmount, setConvertTo, claimWrappedQiDepositHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import SharedButton from "../../components/Shared/SharedButton"
import ConvertTo from "../../components/_NewDesign/ConvertAsset/ConvertTo/ConvertTo"
import { FaTriangleExclamation } from "react-icons/fa6"
import AccountsNotificationPanel from "../../components/AccountsNotificationPanel/AccountsNotificationPanel"
import { selectQiWalletSyncInProgress, setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import ConvertFrom from "../../components/_NewDesign/ConvertAsset/ConvertFrom/ConvertFrom"
import ConvertFromAmount from "../../components/_NewDesign/ConvertAsset/ConvertFromAmount/ConvertFromAmount"
import { useSelector } from "react-redux"

interface WrapLocationState {
  sentWrap?: boolean
  isUnwrap?: boolean
}

const MIN_QUAI_REQUIREMENT = 0.5

const WrapPage = () => {
    const { t } = useTranslation("translation", {
        keyPrefix: "wallet",
      })
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const location = useLocation<WrapLocationState>()
  const isUnwrap = location.pathname === "/unwrap"
  const from = useBackgroundSelector((state) => state.convertAssets.from)
  const amount = useBackgroundSelector((state) => state.convertAssets.amount)
  const to = useBackgroundSelector((state) => state.convertAssets.to)
  const wrappedQiDeposit = useBackgroundSelector((state) => state.convertAssets.wrappedQiDeposit)
  const qiWalletSyncInProgress = useSelector(selectQiWalletSyncInProgress)
  const [isClaiming, setIsClaiming] = useState(false)
  useEffect(() => {
    if (to && isAccountTotalTypeGuard(to)) {
      dispatch(getWrappedQiDepositHandle({ from: to.address }))
    }
  }, [to, dispatch])

  const isDisabledHandle = () => {
    if (isUnwrap) {
      // For unwrapping: from is Quai account with WQI
      if (!from || !amount || !isAccountTotalTypeGuard(from)) {
        return true
      }

      const parsedAmount = parseFloat(amount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return true
      }

      // Check if WQI balance is sufficient
      // Parse balance like "48,205.4 WQI" correctly
      const balanceParts = from.balance?.split(" ") ?? []
      const balanceStr = balanceParts[0] ?? "0"
      // Remove commas before parsing
      const cleanedBalance = balanceStr.replace(/,/g, '')
      const wqiBalance = parseFloat(cleanedBalance)
      return wqiBalance < parsedAmount
    } else {
      // For wrapping: from is Qi account, to is Quai account
      if (!from || !amount || !to || !isUtxoAccountTypeGuard(from)) {
        return true
      }

      const parsedAmount = parseFloat(amount)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return true
      }

      if (!isAccountTotalTypeGuard(to)) {
        return true
      }

      const quaiBalance = to.balance ?? "0"
      if (parseFloat(quaiBalance) < MIN_QUAI_REQUIREMENT) {
        return true
      }

      if (
        from &&
        isUtxoAccountTypeGuard(from) &&
        from?.balances[Zone.Cyprus1]
      ) {
        return Number(
          formatQi(
            from?.balances[Zone.Cyprus1]?.assetAmount?.amount
          )
        ) < parsedAmount
      }

      return true
    }
  }

  const handleConfirm = () => {
    if (isUnwrap) {
      // For unwrapping
      if (!from || !amount || !isAccountTotalTypeGuard(from)) {
        return
      }

      try {
        dispatch(setConvertFrom(from))
        dispatch(setConvertAmount(amount))
        // No need to set 'to' for unwrapping
        history.push("/unwrap/confirmation")
      } catch (error) {
        console.error("Failed to navigate to confirmation page:", error)
      }
    } else {
      // For wrapping
      if (!from || !amount || !to || !isUtxoAccountTypeGuard(from)) {
        return
      }

      try {
        dispatch(setConvertFrom(from))
        dispatch(setConvertAmount(amount))
        dispatch(setConvertTo(to))
        history.push("/wrap/confirmation")
      } catch (error) {
        console.error("Failed to navigate to confirmation page:", error)
      }
    }
  }

  const renderDepositBalance = () => {
    if (!wrappedQiDeposit || wrappedQiDeposit === BigInt(0)) {
      if (location.state?.sentWrap && !isClaiming) {
        return (
          <div className="details-wrapper">
            <div className="details-row">
              <p className="details-row-key">Pending Deposit to WQI</p>
              <p className="details-row-value">Loading...</p>
            </div>
            <style jsx>{`
            .details-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: var(--secondary-bg);
              border-radius: 8px;
              padding: 2%;
              margin-bottom: 3%;
            }
            .details-row-key {
              font-weight: 900;
              font-size: 14px;
              line-height: 18px;
              color: var(--secondary-text);
            }
            .details-row-value {
              font-weight: 500;
              font-size: 14px;
              line-height: 20px;
              color: var(--primary-text);
            }
          `}</style>
          </div>
        )
      } else {
        return null
      }
    }

    return (
      <div className="details-wrapper">
        <div className="details-row">
          <p className="details-row-key">Pending Deposit to WQI</p>
          <p className="details-row-value">{formatQi(wrappedQiDeposit)} QI</p>
        </div>
        <SharedButton
          type="secondary"
          size="medium"
          onClick={async () => {
            if (to && isAccountTotalTypeGuard(to)) {
              setIsClaiming(true)
              await dispatch(claimWrappedQiDepositHandle({ from: to.address }))
              const intervalId = setInterval(() => {
                dispatch(getWrappedQiDepositHandle({ from: to.address }))
              }, 10000)
              setTimeout(() => {
                clearInterval(intervalId)
              }, 5 * 60 * 1000) // 5 minutes in milliseconds
            }
          }}
          isDisabled={isClaiming}
          isLoading={isClaiming}
        >
          Claim
        </SharedButton>

      <style jsx>{`
        .details-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--secondary-bg);
          border-radius: 8px;
          padding: 2%;
          margin-bottom: 3%;
        }
        .details-row-key {
          font-weight: 900;
          font-size: 14px;
          line-height: 18px;
          color: var(--secondary-text);
        }
        .details-row-value {
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--primary-text);
        }
      `}</style>
      </div>
    )
  }

  const hasMinimumQuai = () => {
    if (!to || !isAccountTotalTypeGuard(to)) {
      return false
    }
    const quaiBalance = to.balance ?? "0"
    return parseFloat(quaiBalance) >= MIN_QUAI_REQUIREMENT
  }

  return (
    <div className="wrap_page">
      <div className="header-area">
          <SharedGoBackPageHeader 
            title={isUnwrap ? "Unwrap WQI" : "Wrap Qi"} 
            linkTo={isUnwrap ? "/" : "/"} 
          />
          <div className="disclaimer">
            {isUnwrap 
              ? "Unwrap your WQI tokens back to native Qi."
              : "Wrap your Qi to be used with Quai in the EVM."
            }
          </div>
        </div>
      <div className="content">
        {isUnwrap ? (
          // For unwrap, show the from account without allowing changes
          <section className="convert-from-wallet">
            <h3 className="convert-from-label">From</h3>
            {from && (
              <div className="account-display">
                <div className="account-info">
                  <div className="account-name">QUAI Account (WQI)</div>
                  <div className="account-address">{isAccountTotalTypeGuard(from) && from.address?.slice(0, 10)}...{isAccountTotalTypeGuard(from) && from.address?.slice(-8)}</div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <ConvertFrom />
        )}
        <ConvertFromAmount />
        {!isUnwrap && <ConvertTo />}
        {!isUnwrap && !hasMinimumQuai() && (
          <div className="error">
            <FaTriangleExclamation className="error-icon" />
            {"Minimum Quai Required for Gas fees: " + MIN_QUAI_REQUIREMENT}
          </div>
        )}
        {!isUnwrap && renderDepositBalance()}
        {isUnwrap && (
          <>
            <div className="info-box">
              <p>Your unwrapped Qi will be sent to an available address in your Qi wallet.</p>
            </div>
            <div className="info-box">
              <p style={{ fontWeight: "bold" }}>Note: Qi will be locked for two weeks. Only whole numbers of WQI can be unwrapped. Fractional amounts are not supported.</p>
            </div>
          </>
        )}
      </div>
      <SharedActionButtons
        title={{ confirmTitle: isUnwrap ? "Unwrap" : "Wrap", cancelTitle: "Cancel" }}
        onClick={{ onConfirm: handleConfirm, onCancel: () => history.push("/") }}
        isConfirmDisabled={isDisabledHandle()}
        isLoading={qiWalletSyncInProgress}
      />
      <AccountsNotificationPanel
        onCurrentAddressChange={() => dispatch(setShowingAccountsModal(false))}
        isNeedToChangeAccount={false}
      />
      <style jsx>{`
        .wrap_page {
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
        .content {
          flex: 1;
          overflow-y: auto;
          padding: 0 16px;
        }
        .disclaimer {
          margin: -15px 0 5px 0;
          padding: 8px;
          background-color: rgba(255, 246, 214, 0.5);
          border-radius: 8px;
          font-size: 14px;
          text-align: center;
          color: #896404;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .error {
          padding: 8px;
          background-color: rgba(255, 246, 214, 0.5);
          border-radius: 8px;
          font-size: 14px;
          text-align: center;
          color: #896404;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .info-box {
          padding: 12px;
          background-color: rgba(33, 150, 243, 0.1);
          border-radius: 8px;
          margin: 16px 0;
        }
        .info-box p {
          margin: 0;
          font-size: 14px;
          color: var(--primary-text);
          text-align: center;
        }
        .warning-box {
          padding: 12px;
          background-color: rgba(255, 193, 7, 0.1);
          border: 1px solid rgba(255, 193, 7, 0.3);
          border-radius: 8px;
          margin: 8px 0;
        }
        .warning-box p {
          margin: 0;
          font-size: 13px;
          color: #ffc107;
          text-align: center;
        }
        .convert-from-wallet {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 8px;
        }
        .convert-from-label {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--secondary-text);
        }
        .account-display {
          background: var(--secondary-bg);
          border: 1px solid var(--border-dark);
          border-radius: 12px;
          padding: 12px 16px;
        }
        .account-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .account-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text);
        }
        .account-address {
          font-size: 12px;
          color: var(--secondary-text);
        }
      `}</style>
    </div>
  )
}

export default WrapPage 