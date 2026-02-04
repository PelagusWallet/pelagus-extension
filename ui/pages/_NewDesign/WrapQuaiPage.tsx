import React, { useMemo, useState } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { selectCurrentAccountBalances, selectCurrentAccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import { setConvertAmount, setConvertFrom, wrapQuaiHandle, unwrapQuaiHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { triggerManualBalanceUpdate } from "@pelagus/pelagus-background/redux-slices/accounts"
import { WRAPPED_QUAI_CONTRACT_ADDRESS } from "@pelagus/pelagus-background/constants/base-assets"
import { bigIntToDecimal } from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import { isSmartContractFungibleAsset } from "@pelagus/pelagus-background/assets"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedButton from "../../components/Shared/SharedButton"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"

export default function WrapQuaiPage(): React.ReactElement {
  const history = useHistory()
  const location = useLocation()
  const dispatch = useBackgroundDispatch()
  const balances = useBackgroundSelector(selectCurrentAccountBalances)
  const account = useBackgroundSelector(selectCurrentAccountTotal)

  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isUnwrap = location.pathname.includes("/unwrap-wquai")

  const { quaiBalance, wquaiBalance } = useMemo(() => {
    let quai = "0"
    let wquai = "0"
    if (balances?.assetAmounts) {
      const quaiEntry = balances.assetAmounts.find(({ asset }) => asset.symbol === "QUAI")
      if (quaiEntry) {
        quai = bigIntToDecimal(quaiEntry.amount as bigint, 18, 6)
      }
      const wquaiEntry = balances.assetAmounts.find(
        ({ asset }) =>
          isSmartContractFungibleAsset(asset) &&
          asset.symbol === "WQUAI" &&
          asset.contractAddress.toLowerCase() === WRAPPED_QUAI_CONTRACT_ADDRESS.toLowerCase()
      )
      if (wquaiEntry) {
        wquai = bigIntToDecimal(wquaiEntry.amount as bigint, 18, 6)
      }
    }
    return { quaiBalance: quai, wquaiBalance: wquai }
  }, [balances])

  const sourceBalance = isUnwrap ? wquaiBalance : quaiBalance
  const sourceSymbol = isUnwrap ? "WQUAI" : "QUAI"
  const targetSymbol = isUnwrap ? "QUAI" : "WQUAI"

  const isValidAmount = () => {
    const val = parseFloat(amount)
    return !isNaN(val) && val > 0 && val <= parseFloat(sourceBalance)
  }

  const handleMax = () => {
    // When wrapping QUAI, reserve some for gas fees
    // When unwrapping WQUAI, no gas reservation needed on the WQUAI side
    if (!isUnwrap) {
      const balance = parseFloat(sourceBalance)
      const gasReserve = 0.01 // Reserve 0.01 QUAI for gas
      const maxAmount = Math.max(0, balance - gasReserve)
      setAmount(maxAmount > 0 ? maxAmount.toString() : "0")
    } else {
      setAmount(sourceBalance)
    }
  }

  const handleSubmit = async () => {
    if (!isValidAmount() || !account) return
    setIsLoading(true)
    dispatch(setConvertFrom(account))
    dispatch(setConvertAmount(amount))

    const result: any = isUnwrap
      ? await dispatch(unwrapQuaiHandle())
      : await dispatch(wrapQuaiHandle())

    if (result?.txHash) {
      setError(null)
      await dispatch(triggerManualBalanceUpdate())
    } else {
      setError(result?.error?.message || `Failed to ${isUnwrap ? "unwrap" : "wrap"}`)
    }
    setModalOpen(true)
    setIsLoading(false)
  }

  return (
    <main className="wrap-page">
      <div className="header-area">
        <SharedGoBackPageHeader title={isUnwrap ? "Unwrap WQUAI" : "Wrap QUAI"} linkTo="/" />
      </div>

      <div className="content">
        <div className="toggle-row">
          <button
            className={`toggle-btn ${!isUnwrap ? "active" : ""}`}
            onClick={() => history.push("/wrap-quai")}
          >
            Wrap
          </button>
          <button
            className={`toggle-btn ${isUnwrap ? "active" : ""}`}
            onClick={() => history.push("/unwrap-wquai")}
          >
            Unwrap
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="label">{sourceSymbol}</span>
            <span className="balance">Balance: {sourceBalance}</span>
          </div>
          <div className="input-row">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              min="0"
              value={amount}
              onChange={(e) => {
                const val = e.target.value
                if (val === "" || parseFloat(val) >= 0) {
                  setAmount(val)
                }
              }}
            />
            <button className="max-btn" onClick={handleMax}>MAX</button>
          </div>
        </div>

        <div className="action-row">
          <SharedButton
            type="primary"
            size="medium"
            onClick={handleSubmit}
            isDisabled={!isValidAmount() || isLoading}
            isLoading={isLoading}
            center
          >
            {isUnwrap ? "Unwrap" : "Wrap"}
          </SharedButton>
        </div>
      </div>

      <SharedConfirmationModal
        headerTitle={error ? "Error" : "Success"}
        icon={error ? { src: "icons/s/notif-wrong.svg", width: "35", height: "35", color: "var(--red-60)", padding: "35px 32px" } : undefined}
        title={error ? `Failed to ${isUnwrap ? "unwrap" : "wrap"}` : `${amount} ${sourceSymbol} → ${targetSymbol}`}
        subtitle={error || `Your ${targetSymbol} is now available`}
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setAmount(""); history.push("/") }}
      />

      <style jsx>{`
        .wrap-page {
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
        .toggle-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .toggle-btn {
          flex: 1;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid var(--border-dark);
          background: var(--secondary-bg);
          color: var(--secondary-text);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .toggle-btn.active {
          background: var(--accent-color);
          border-color: var(--accent-color);
          color: white;
        }
        .card {
          background: var(--secondary-bg);
          border: 1px solid var(--border-dark);
          border-radius: 12px;
          padding: 12px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .label {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary-text);
        }
        .balance, .rate {
          font-size: 12px;
          color: var(--secondary-text);
        }
        .input-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .input-row input {
          flex: 1;
          font-size: 24px;
          font-weight: 500;
          background: transparent;
          border: none;
          color: var(--primary-text);
          outline: none;
          min-width: 0;
        }
        .input-row input::placeholder {
          color: var(--secondary-text);
        }
        .max-btn {
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid var(--green-60);
          background: transparent;
          color: var(--green-60);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .action-row {
          margin-top: 16px;
          display: flex;
        }
        .action-row :global(button) {
          flex: 1;
        }
      `}</style>
    </main>
  )
}
