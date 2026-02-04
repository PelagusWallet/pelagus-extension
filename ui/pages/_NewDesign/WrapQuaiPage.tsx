import React, { useMemo, useState } from "react"
import { useHistory, useLocation } from "react-router-dom"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedButton from "../../components/Shared/SharedButton"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { selectCurrentAccountBalances, selectCurrentAccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import { setConvertAmount, setConvertFrom, unwrapQuaiHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { WRAPPED_QUAI_CONTRACT_ADDRESS } from "@pelagus/pelagus-background/constants/base-assets"
import { bigIntToDecimal } from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import { isSmartContractFungibleAsset } from "@pelagus/pelagus-background/assets"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"

const WrapQuaiPage: React.FC = () => {
  const history = useHistory()
  const location = useLocation()
  const dispatch = useBackgroundDispatch()
  const account = useBackgroundSelector(selectCurrentAccountTotal)
  const balances = useBackgroundSelector(selectCurrentAccountBalances)
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isUnwrap = useMemo(() => location.pathname.includes("/unwrap-wquai"), [location.pathname])

  const { quaiBalance, wquaiBalance } = useMemo(() => {
    let quai = "0"
    let wquai = "0"
    if (balances?.assetAmounts) {
      const quaiEntry = balances.assetAmounts.find(({ asset }) => asset.symbol === "QUAI")
      if (quaiEntry) {
        const decimals = (quaiEntry.asset as any).decimals ?? 18
        quai = bigIntToDecimal(quaiEntry.amount as bigint, decimals, 4)
      }
      const wquaiEntry = balances.assetAmounts.find(({ asset }) =>
        isSmartContractFungibleAsset(asset) && asset.symbol === "WQUAI" && asset.contractAddress.toLowerCase() === WRAPPED_QUAI_CONTRACT_ADDRESS.toLowerCase()
      )
      if (wquaiEntry) {
        const decimals = (wquaiEntry.asset as any).decimals ?? 18
        wquai = bigIntToDecimal(wquaiEntry.amount as bigint, decimals, 4)
      } else {
        wquai = "0"
      }
    }
    return { quaiBalance: quai, wquaiBalance: wquai }
  }, [balances])

  const onContinue = async () => {
    if (!account || !amount) return
    if (!isUnwrap) {
      dispatch(setConvertFrom(account))
      dispatch(setConvertAmount(amount))
      history.push("/wrap-quai/confirmation")
    } else {
      setIsLoading(true)
      dispatch(setConvertAmount(amount))
      const result: any = await dispatch(unwrapQuaiHandle())
      if (result?.txHash) {
        setError(null)
      } else {
        setError(result?.error?.message || "Failed to unwrap WQUAI")
      }
      setIsOpen(true)
      setIsLoading(false)
    }
  }

  return (
    <main>
      <div className="header-area">
        <SharedGoBackPageHeader title={"Wrap"} linkTo="/" />
        <div className="toggle">
          <button className={`toggle-btn ${!isUnwrap ? "active" : ""}`} onClick={() => history.push("/wrap-quai")}>Wrap</button>
          <button className={`toggle-btn ${isUnwrap ? "active" : ""}`} onClick={() => history.push("/unwrap-wquai")}>Unwrap</button>
        </div>
      </div>
      <div className="content">
        <div className="balances">
          <div className="balance-card">
            <div className="balance-label">QUAI Balance</div>
            <div className="balance-value">{quaiBalance} QUAI</div>
          </div>
          <div className="balance-card">
            <div className="balance-label">WQUAI Balance</div>
            <div className="balance-value">{wquaiBalance} WQUAI</div>
          </div>
        </div>
        <div className="convert-cards">
          <section className="convert-card">
            <div className="convert-label">From</div>
            <div className="asset-row">
              <div className="asset-info">
                <div className="asset-name">{isUnwrap ? "WQUAI" : "QUAI"}</div>
                <div className="asset-sub">Balance: {isUnwrap ? wquaiBalance : quaiBalance}</div>
              </div>
              <input
                className="amount-input"
                type="number"
                min="0"
                step="any"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </section>
          <section className="convert-card">
            <div className="convert-label">To</div>
            <div className="asset-row">
              <div className="asset-info">
                <div className="asset-name">{isUnwrap ? "QUAI" : "WQUAI"}</div>
                <div className="asset-sub">1 {isUnwrap ? "WQUAI" : "QUAI"} = 1 {isUnwrap ? "QUAI" : "WQUAI"}</div>
              </div>
              <div className="amount-preview">{amount || "0.0"}</div>
            </div>
          </section>
        </div>
      </div>
      <div className="footer">
        <SharedButton type="primary" size="large" onClick={onContinue} isDisabled={isLoading} isLoading={isLoading} style={{ color: 'white' }}>
          {isUnwrap ? "Confirm Unwrap" : "Continue"}
        </SharedButton>
      </div>
      <SharedConfirmationModal
        headerTitle={error ? "Error" : "Unwrap Success"}
        icon={
          error
            ? {
                src: "icons/s/notif-wrong.svg",
                width: "35",
                height: "35",
                color: "var(--red-60)",
                padding: "35px 32px",
              }
            : undefined
        }
        title={error ? "Failed to unwrap" : "WQUAI unwrapped successfully"}
        subtitle={error || "Your QUAI has been returned to your address"}
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); history.push("/") }}
      />
      <style jsx>{`
        .header-area { position: sticky; top: 0; z-index: 10; background: var(--primary-bg); padding: 16px 16px 0; }
        .toggle { display: flex; gap: 8px; padding: 8px 16px 0; }
        .toggle-btn { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--secondary-bg); color: var(--primary-text); cursor: pointer; }
        .toggle-btn.active { background: var(--primary-bg); border-color: var(--green-60); }
        .content { padding: 16px; }
        .balances { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .balance-card { background: var(--secondary-bg); border: 1px solid var(--border-dark); border-radius: 12px; padding: 12px; }
        .balance-label { font-size: 12px; color: var(--secondary-text); }
        .balance-value { font-size: 16px; font-weight: 500; color: var(--primary-text); }
        .convert-cards { display: flex; flex-direction: column; gap: 8px; }
        .convert-card { background: var(--secondary-bg); border: 1px solid var(--border-dark); border-radius: 12px; padding: 12px; }
        .convert-label { font-size: 12px; color: var(--secondary-text); margin-bottom: 8px; }
        .asset-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .asset-info { display: flex; flex-direction: column; gap: 2px; }
        .asset-name { font-size: 16px; font-weight: 500; color: var(--primary-text); }
        .asset-sub { font-size: 12px; color: var(--secondary-text); }
        .amount-input { flex: 0 0 120px; text-align: right; padding: 10px; border-radius: 8px; border: 1px solid var(--border-dark); background: var(--primary-bg); color: var(--primary-text); }
        .amount-preview { min-width: 120px; text-align: right; font-size: 16px; font-weight: 500; color: var(--primary-text); }
        .footer { padding: 16px; }
      `}</style>
    </main>
  )
}

export default WrapQuaiPage
