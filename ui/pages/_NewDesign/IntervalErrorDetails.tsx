import React, { useEffect, useState } from "react"
import { useHistory, useParams } from "react-router-dom"
import { FaCircleXmark, FaSpinner } from "react-icons/fa6"
import { useBackgroundDispatch } from "../../hooks"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { getIntervalConversionHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { isUtxoAccountTypeGuard } from "../../utils/accounts"

interface IntervalConversion {
  id: string
  from: any
  to: any
  amount: string
  maxSlippage: number
  transactionCount: number
  intervalMinutes: number
  executedCount: number
  status: string
  startedAt: number
  completedAt?: number
  error?: string
  transactions: string[]
}

const IntervalErrorDetails = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const { intervalId } = useParams<{ intervalId: string }>()
  const [interval, setInterval] = useState<IntervalConversion | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIntervalDetails()
  }, [intervalId])

  const loadIntervalDetails = async () => {
    try {
      const result = await dispatch(getIntervalConversionHandle(intervalId)) as any
      if (result.payload) {
        setInterval(result.payload)
      }
    } catch (error) {
      console.error("Failed to load interval details:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (startTime: number, endTime: number) => {
    const durationMs = endTime - startTime
    const minutes = Math.floor(durationMs / 60000)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    }
    return `${minutes} minutes`
  }

  if (loading) {
    return (
      <main className="error-details-wrapper">
        <SharedGoBackPageHeader title="Error Details" linkTo="/intervals" />
        <div className="loading-container">
          <FaSpinner className="loading-icon spin" />
          <p>Loading details...</p>
        </div>
      </main>
    )
  }

  if (!interval) {
    return (
      <main className="error-details-wrapper">
        <SharedGoBackPageHeader title="Error Details" linkTo="/intervals" />
        <div className="error-state">
          <p>Interval not found</p>
        </div>
      </main>
    )
  }

  const isFromUtxo = interval.from && isUtxoAccountTypeGuard(interval.from)
  const fromLabel = isFromUtxo ? "Qi" : "Quai"
  const toLabel = isFromUtxo ? "Quai" : "Qi"

  return (
    <>
      <main className="error-details-wrapper">
        <div className="header-area">
          <SharedGoBackPageHeader title="Interval Error Details" linkTo="/intervals" />
        </div>

        <div className="content-area">
          <div className="error-header">
            <FaCircleXmark className="error-icon" />
            <h2>Conversion Failed</h2>
          </div>

          <div className="detail-card">
            <h3>Error Information</h3>
            <div className="error-message">
              {interval.error || "Unknown error occurred"}
            </div>
          </div>

          <div className="detail-card">
            <h3>Conversion Details</h3>
            
            <div className="detail-row">
              <span className="label">Conversion Type:</span>
              <span className="value">{fromLabel} → {toLabel}</span>
            </div>

            <div className="detail-row">
              <span className="label">Amount per Transaction:</span>
              <span className="value">{interval.amount} {fromLabel}</span>
            </div>

            <div className="detail-row">
              <span className="label">Max Slippage:</span>
              <span className="value">{(interval.maxSlippage / 100).toFixed(2)}%</span>
            </div>

            <div className="detail-row">
              <span className="label">Interval:</span>
              <span className="value">{interval.intervalMinutes} minute{interval.intervalMinutes !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="detail-card">
            <h3>Execution Summary</h3>
            
            <div className="detail-row">
              <span className="label">Completed Transactions:</span>
              <span className="value highlight">{interval.executedCount} / {interval.transactionCount}</span>
            </div>

            <div className="detail-row">
              <span className="label">Started At:</span>
              <span className="value">{formatDate(interval.startedAt)}</span>
            </div>

            {interval.completedAt && (
              <div className="detail-row">
                <span className="label">Failed At:</span>
                <span className="value">{formatDate(interval.completedAt)}</span>
              </div>
            )}

            {interval.completedAt && (
              <div className="detail-row">
                <span className="label">Total Duration:</span>
                <span className="value">
                  {formatDuration(interval.startedAt, interval.completedAt)}
                </span>
              </div>
            )}

            <div className="detail-row">
              <span className="label">Total Amount Converted:</span>
              <span className="value highlight">
                {(Number(interval.amount) * interval.executedCount).toFixed(2)} {fromLabel}
              </span>
            </div>
          </div>

          {interval.transactions.length > 0 && (
            <div className="detail-card">
              <h3>Transaction History</h3>
              <div className="transactions-list">
                {interval.transactions.map((txHash, index) => (
                  <div key={txHash} className="transaction-item">
                    <span className="tx-index">#{index + 1}</span>
                    <span className="tx-hash">{txHash}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="recommendation-card">
            <h3>Recommended Actions</h3>
            <ul>
              {interval.error?.includes("balance") && (
                <>
                  <li>Check your account balance</li>
                  <li>Ensure you have enough {fromLabel} for the conversion</li>
                  <li>Consider reducing the amount per transaction</li>
                </>
              )}
              {interval.error?.includes("slippage") && (
                <>
                  <li>Increase the maximum slippage tolerance</li>
                  <li>Try converting during less volatile periods</li>
                </>
              )}
              <li>Retry with smaller transaction amounts</li>
              <li>Check network status and try again later</li>
            </ul>
          </div>

          <div className="action-buttons">
            <button 
              className="retry-button"
              onClick={() => history.push("/convert")}
            >
              Set Up New Conversion
            </button>
            <button 
              className="back-button"
              onClick={() => history.push("/intervals")}
            >
              Back to Intervals
            </button>
          </div>
        </div>
      </main>

      <style jsx>{`
        .error-details-wrapper {
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
          padding-bottom: 80px;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: var(--secondary-text);
        }

        .loading-icon {
          font-size: 32px;
          margin-bottom: 16px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .error-state {
          text-align: center;
          padding: 40px;
          color: var(--secondary-text);
        }

        .error-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 24px;
        }

        .error-icon {
          font-size: 48px;
          color: #f44336;
          margin-bottom: 12px;
        }

        .error-header h2 {
          color: var(--primary-text);
          margin: 0;
          font-size: 20px;
        }

        .detail-card {
          background: var(--hunter-green);
          border: 1px solid var(--green-20);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .detail-card h3 {
          color: var(--primary-text);
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .error-message {
          padding: 12px;
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid rgba(244, 67, 54, 0.3);
          border-radius: 8px;
          color: #f44336;
          font-size: 14px;
          line-height: 1.5;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-size: 13px;
        }

        .label {
          color: var(--secondary-text);
        }

        .value {
          color: var(--primary-text);
          font-weight: 500;
        }

        .value.highlight {
          color: var(--success);
          font-weight: 600;
        }

        .transactions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .transaction-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          font-size: 12px;
        }

        .tx-index {
          color: var(--secondary-text);
          min-width: 30px;
        }

        .tx-hash {
          color: var(--primary-text);
          font-family: monospace;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .recommendation-card {
          background: rgba(255, 193, 7, 0.05);
          border: 1px solid rgba(255, 193, 7, 0.2);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .recommendation-card h3 {
          color: #ffc107;
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 12px 0;
        }

        .recommendation-card ul {
          margin: 0;
          padding-left: 20px;
        }

        .recommendation-card li {
          color: var(--secondary-text);
          font-size: 13px;
          line-height: 1.6;
          margin-bottom: 4px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .retry-button,
        .back-button {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .retry-button {
          background: var(--success);
          color: white;
          border: none;
        }

        .retry-button:hover {
          opacity: 0.9;
        }

        .back-button {
          background: transparent;
          color: var(--primary-text);
          border: 1px solid var(--green-40);
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </>
  )
}

export default IntervalErrorDetails