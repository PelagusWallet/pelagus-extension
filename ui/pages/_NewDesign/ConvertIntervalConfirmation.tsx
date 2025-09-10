import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import { FaClock, FaRepeat, FaTriangleExclamation } from "react-icons/fa6"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import { startIntervalConversionHandle, resetConvertAssetsSlice } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { isUtxoAccountTypeGuard } from "../../utils/accounts"

const ConvertIntervalConfirmation = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { from, to, amount, maxSlippage, intervalSettings } = useBackgroundSelector(
    (state) => state.convertAssets
  )

  const isFromUtxo = from && isUtxoAccountTypeGuard(from)
  const fromLabel = isFromUtxo ? "Qi" : "Quai"
  const toLabel = isFromUtxo ? "Quai" : "Qi"

  const handleConfirm = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const result = await dispatch(startIntervalConversionHandle()) as any
      
      if (result.payload?.error) {
        setError(result.payload.error)
        setIsProcessing(false)
      } else {
        // Success - clear state and navigate
        setTimeout(() => {
          dispatch(resetConvertAssetsSlice())
          history.push("/")
        }, 2000)
      }
    } catch (err: any) {
      setError(err?.message || "Failed to start interval conversion")
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    history.push("/convert")
  }

  return (
    <>
      <main className="confirmation-wrapper">
        <div className="header-area">
          <SharedGoBackPageHeader 
            title="Confirm Interval Conversion" 
            linkTo="/convert" 
          />
        </div>

        <div className="content-area">
          <div className="summary-card">
            <h3 className="summary-title">Interval Conversion Details</h3>
            
            <div className="detail-row">
              <span className="label">Convert From:</span>
              <span className="value">{fromLabel}</span>
            </div>

            <div className="detail-row">
              <span className="label">Convert To:</span>
              <span className="value">{toLabel}</span>
            </div>

            <div className="detail-row">
              <span className="label">Amount per Transaction:</span>
              <span className="value">{amount} {fromLabel}</span>
            </div>

            <div className="detail-row">
              <span className="label">Max Slippage:</span>
              <span className="value">{(maxSlippage / 100).toFixed(2)}%</span>
            </div>

            <div className="divider" />

            <div className="interval-details">
              <div className="detail-row highlight">
                <span className="label">
                  <FaRepeat className="icon" />
                  Total Transactions:
                </span>
                <span className="value">{intervalSettings.transactionCount}</span>
              </div>

              <div className="detail-row highlight">
                <span className="label">
                  <FaClock className="icon" />
                  Interval:
                </span>
                <span className="value">
                  {intervalSettings.intervalMinutes} minute{intervalSettings.intervalMinutes !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="detail-row highlight">
                <span className="label">Total Amount:</span>
                <span className="value bold">
                  {(Number(amount) * intervalSettings.transactionCount).toFixed(2)} {fromLabel}
                </span>
              </div>

              <div className="detail-row highlight">
                <span className="label">Total Duration:</span>
                <span className="value">
                  ~{((intervalSettings.transactionCount - 1) * intervalSettings.intervalMinutes)} minutes
                </span>
              </div>
            </div>
          </div>

          <div className="warning-box">
            <FaTriangleExclamation className="warning-icon" />
            <div className="warning-content">
              <p className="warning-title">Important Notice</p>
              <p className="warning-text">
                You can cancel this interval conversion at any time from the intervals page.
                The conversion will also stop automatically if your balance becomes insufficient.
              </p>
            </div>
          </div>

          {error && (
            <div className="error-box">
              <p className="error-text">{error}</p>
            </div>
          )}

          {isProcessing && (
            <div className="success-box">
              <p className="success-text">
                Interval conversion started! First transaction is being processed...
              </p>
            </div>
          )}
        </div>

        <div className="footer-area">
          <SharedActionButtons
            title={{ 
              confirmTitle: isProcessing ? "Processing..." : "Start Interval", 
              cancelTitle: "Back" 
            }}
            onClick={{
              onConfirm: handleConfirm,
              onCancel: handleCancel,
            }}
            isConfirmDisabled={isProcessing || !from || !to || !amount}
            isLoading={isProcessing}
          />
        </div>
      </main>

      <style jsx>{`
        .confirmation-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .header-area {
          padding: 16px 16px 0;
          background: var(--primary-bg);
        }

        .content-area {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          margin-bottom: 80px;
        }

        .summary-card {
          background: var(--secondary-bg);
          border: 1px solid var(--border-dark);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
        }

        .summary-title {
          color: var(--primary-text);
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          color: var(--secondary-text);
          font-size: 14px;
        }

        .detail-row.highlight {
          background: var(--secondary-bg);
          border: 1px solid var(--border-dark);
          padding: 10px 8px;
          border-radius: 6px;
          margin: 4px 0;
        }

        .label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--secondary-text);
        }

        .value {
          color: var(--primary-text);
          font-weight: 500;
        }

        .value.bold {
          font-weight: 600;
          font-size: 15px;
        }

        .icon {
          font-size: 14px;
        }

        .divider {
          border-top: 1px solid var(--border-dark);
          margin: 16px 0;
        }

        .interval-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .warning-box {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: var(--secondary-bg);
          border: 1px solid var(--attention);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .warning-icon {
          color: var(--attention);
          font-size: 20px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .warning-content {
          flex: 1;
        }

        .warning-title {
          color: var(--attention);
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .warning-text {
          color: var(--secondary-text);
          font-size: 13px;
          margin: 0;
          line-height: 1.4;
        }

        .error-box {
          padding: 12px;
          background: var(--secondary-bg);
          border: 1px solid var(--error-color);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .error-text {
          color: var(--error-color);
          font-size: 14px;
          margin: 0;
        }

        .success-box {
          padding: 12px;
          background: var(--secondary-bg);
          border: 1px solid var(--success-color);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .success-text {
          color: var(--success-color);
          font-size: 14px;
          margin: 0;
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
      `}</style>
    </>
  )
}

export default ConvertIntervalConfirmation
