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
}

const MIN_QUAI_REQUIREMENT = 0.5

const WrapPage = () => {
    const { t } = useTranslation()
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const location = useLocation<WrapLocationState>()
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

  const handleConfirm = () => {
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
          <SharedGoBackPageHeader title={t("common.wrapQi")} linkTo="/" />
          <div className="disclaimer">
            {t("common.wrapQiDescription")}
          </div>
        </div>
      <div className="content">
        <ConvertFrom />
        <ConvertFromAmount />
        <ConvertTo />
        {!hasMinimumQuai() && (
          <div className="error">
            <FaTriangleExclamation className="error-icon" />
            {t("common.minimumQuaiRequiredForGas", { amount: MIN_QUAI_REQUIREMENT })}
          </div>
        )}
        {renderDepositBalance()}
      </div>
      <SharedActionButtons
        title={{ confirmTitle: t("common.wrap"), cancelTitle: t("common.cancel") }}
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
      `}</style>
    </div>
  )
}

export default WrapPage 