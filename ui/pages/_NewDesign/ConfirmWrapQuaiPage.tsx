import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedButton from "../../components/Shared/SharedButton"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"
import { wrapQuaiHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { triggerManualBalanceUpdate } from "@pelagus/pelagus-background/redux-slices/accounts"

const ConfirmWrapQuaiPage: React.FC = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const { from, amount } = useBackgroundSelector((state) => state.convertAssets)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onConfirm = async () => {
    if (!from || !amount) return
    setIsLoading(true)
    const result: any = await dispatch(wrapQuaiHandle())
    if (result?.txHash) {
      setError(null)
      // Force-refresh balances so WQUAI balance appears immediately
      await dispatch(triggerManualBalanceUpdate())
    } else {
      setError(result?.error?.message || "Failed to wrap QUAI")
    }
    setIsOpen(true)
    setIsLoading(false)
  }

  const closeModal = () => {
    setIsOpen(false)
    history.push("/")
  }

  return (
    <main>
      <div className="header-area">
        <SharedGoBackPageHeader title={"Confirm Wrap"} linkTo="/wrap-quai" />
      </div>
      <div className="content">
        <div className="summary">
          <h5>Wrapping</h5>
          <h2>{amount} QUAI to WQUAI</h2>
          <h5>1 QUAI = 1 WQUAI</h5>
        </div>
      </div>
      <div className="footer">
        <SharedButton type="primary" size="large" onClick={onConfirm} isDisabled={isLoading} isLoading={isLoading} style={{ color: 'white' }}>
          Confirm
        </SharedButton>
      </div>
      <SharedConfirmationModal
        headerTitle={error ? "Error" : "Wrap Success"}
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
        title={error ? "Failed to wrap QUAI" : "QUAI wrapped successfully"}
        subtitle={error || "Your WQUAI has been minted to your address"}
        isOpen={isOpen}
        onClose={closeModal}
      />
      <style jsx>{`
        .content { padding: 16px; }
        .summary { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 24px; }
        h2 { margin: 0; font-size: 32px; font-weight: 500; color: var(--primary-text); }
        h5 { margin: 0; font-size: 14px; font-weight: 500; color: var(--secondary-text); }
        .footer { padding: 16px; }
      `}</style>
    </main>
  )
}

export default ConfirmWrapQuaiPage
