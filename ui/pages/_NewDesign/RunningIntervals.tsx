import React, { useEffect, useState } from "react"
import { useHistory } from "react-router-dom"
import { FaClock, FaCircleCheck, FaCircleXmark, FaSpinner, FaChevronRight, FaBan } from "react-icons/fa6"
import { useBackgroundDispatch } from "../../hooks"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { 
  getIntervalConversionsHandle, 
  cancelIntervalConversionHandle 
} from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { isUtxoAccountTypeGuard } from "../../utils/accounts"

type IntervalStatus = "running" | "completed" | "failed" | "cancelled"

interface IntervalConversion {
  id: string
  from: any
  to: any
  amount: string
  maxSlippage: number
  transactionCount: number
  intervalMinutes: number
  executedCount: number
  status: IntervalStatus
  startedAt: number
  completedAt?: number
  error?: string
  transactions: string[]
}

const RunningIntervals = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const [intervals, setIntervals] = useState<IntervalConversion[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    loadIntervals()
    // Refresh every 10 seconds to update progress
    const refreshInterval = setInterval(loadIntervals, 10000)
    return () => clearInterval(refreshInterval)
  }, [])

  const loadIntervals = async () => {
    try {
      const result = await dispatch(getIntervalConversionsHandle()) as any
      
      // Check if result is the array directly or wrapped in payload
      let intervalsData = []
      if (Array.isArray(result)) {
        // Result is the array directly
        intervalsData = result
      } else if (result?.payload) {
        // Result is wrapped in payload
        intervalsData = result.payload
      }
      
      if (Array.isArray(intervalsData) && intervalsData.length > 0) {
        // Sort by startedAt descending (newest first)
        const sorted = [...intervalsData].sort((a, b) => b.startedAt - a.startedAt)
        setIntervals(sorted)
      } else {
        setIntervals([])
      }
    } catch (error) {
      console.error("Failed to load intervals:", error)
      setIntervals([])
    } finally {
      setLoading(false)
    }
  }

  const handleCancelInterval = async (intervalId: string) => {
    setCancellingId(intervalId)
    try {
      await dispatch(cancelIntervalConversionHandle(intervalId))
      await loadIntervals()
    } catch (error) {
      console.error("Failed to cancel interval:", error)
    } finally {
      setCancellingId(null)
    }
  }

  const handleViewDetails = (interval: IntervalConversion) => {
    if (interval.status === "failed" && interval.error) {
      history.push(`/intervals/error/${interval.id}`)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const getStatusIcon = (status: IntervalStatus) => {
    switch (status) {
      case "running":
        return <FaSpinner className="status-icon running spin" />
      case "completed":
        return <FaCircleCheck className="status-icon completed" />
      case "failed":
        return <FaCircleXmark className="status-icon failed" />
      case "cancelled":
        return <FaBan className="status-icon cancelled" />
      default:
        return null
    }
  }

  const getStatusClass = (status: IntervalStatus) => {
    return `status-badge ${status}`
  }

  const getProgress = (interval: IntervalConversion) => {
    const percentage = (interval.executedCount / interval.transactionCount) * 100
    return Math.min(100, Math.round(percentage))
  }

  if (loading) {
    return (
      <main className="intervals-wrapper">
        <SharedGoBackPageHeader title="Interval Conversions" linkTo="/convert" />
        <div className="loading-container">
          <FaSpinner className="loading-icon spin" />
          <p>Loading intervals...</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="intervals-wrapper">
        <div className="header-area">
          <SharedGoBackPageHeader title="Interval Conversions" linkTo="/convert" />
        </div>

        <div className="content-area">
          {intervals.length === 0 ? (
            <div className="empty-state">
              <FaClock className="empty-icon" />
              <h3>No Interval Conversions</h3>
              <p>You haven't started any interval conversions yet.</p>
            </div>
          ) : (
            <div className="intervals-list">
              {intervals.map((interval) => {
                const isFromUtxo = interval.from && isUtxoAccountTypeGuard(interval.from)
                const fromLabel = isFromUtxo ? "Qi" : "Quai"
                const toLabel = isFromUtxo ? "Quai" : "Qi"
                const progress = getProgress(interval)

                return (
                  <div 
                    key={interval.id} 
                    className={`interval-card ${interval.status === "failed" ? "clickable" : ""}`}
                    onClick={() => interval.status === "failed" && handleViewDetails(interval)}
                  >
                    <div className="interval-header">
                      <div className="interval-title">
                        <span className="conversion-type">
                          {fromLabel} → {toLabel}
                        </span>
                        <div className={getStatusClass(interval.status)}>
                          {getStatusIcon(interval.status)}
                          <span>{interval.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="interval-details">
                      <div className="detail-row">
                        <span className="label">Amount:</span>
                        <span className="value">{interval.amount} {fromLabel}</span>
                      </div>

                      <div className="detail-row">
                        <span className="label">Progress:</span>
                        <span className="value">
                          {interval.executedCount} / {interval.transactionCount} transactions
                        </span>
                      </div>

                      <div className="progress-bar-container">
                        <div className="progress-bar">
                          <div 
                            className={`progress-fill ${interval.status}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="progress-text">{progress}%</span>
                      </div>

                      <div className="detail-row">
                        <span className="label">Interval:</span>
                        <span className="value">{formatDuration(interval.intervalMinutes)}</span>
                      </div>

                      <div className="detail-row">
                        <span className="label">Started:</span>
                        <span className="value">{formatDate(interval.startedAt)}</span>
                      </div>

                      {interval.completedAt && (
                        <div className="detail-row">
                          <span className="label">
                            {interval.status === "completed" ? "Completed:" : "Stopped:"}
                          </span>
                          <span className="value">{formatDate(interval.completedAt)}</span>
                        </div>
                      )}

                      <div className="detail-row">
                        <span className="label">Max Slippage:</span>
                        <span className="value">{(interval.maxSlippage / 100).toFixed(2)}%</span>
                      </div>

                      {interval.error && (
                        <div className="error-row">
                          <span className="error-label">Error:</span>
                          <span className="error-value">{interval.error}</span>
                          <FaChevronRight className="chevron" />
                        </div>
                      )}
                    </div>

                    {interval.status === "running" && (
                      <div className="action-buttons">
                        <button
                          className="cancel-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelInterval(interval.id)
                          }}
                          disabled={cancellingId === interval.id}
                        >
                          {cancellingId === interval.id ? (
                            <>
                              <FaSpinner className="spin" />
                              Cancelling...
                            </>
                          ) : (
                            "Cancel Interval"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .intervals-wrapper {
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

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          color: var(--green-40);
          margin-bottom: 16px;
        }

        .empty-state h3 {
          color: var(--primary-text);
          margin: 0 0 8px 0;
        }

        .empty-state p {
          color: var(--secondary-text);
          margin: 0;
        }

        .intervals-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .interval-card {
          background: var(--hunter-green);
          border: 1px solid var(--green-20);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s;
        }

        .interval-card.clickable {
          cursor: pointer;
        }

        .interval-card.clickable:hover {
          border-color: var(--green-40);
          transform: translateY(-1px);
        }

        .interval-header {
          margin-bottom: 16px;
        }

        .interval-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .conversion-type {
          color: var(--primary-text);
          font-size: 16px;
          font-weight: 600;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
          text-transform: capitalize;
        }

        .status-badge.running {
          background: rgba(33, 150, 243, 0.1);
          color: #2196f3;
        }

        .status-badge.completed {
          background: rgba(76, 175, 80, 0.1);
          color: #4caf50;
        }

        .status-badge.failed {
          background: rgba(244, 67, 54, 0.1);
          color: #f44336;
        }

        .status-badge.cancelled {
          background: rgba(158, 158, 158, 0.1);
          color: #9e9e9e;
        }

        .status-icon {
          font-size: 14px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .interval-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .label {
          color: var(--secondary-text);
        }

        .value {
          color: var(--primary-text);
          font-weight: 500;
        }

        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 8px 0;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: var(--green-10);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .progress-fill.running {
          background: #2196f3;
        }

        .progress-fill.completed {
          background: #4caf50;
        }

        .progress-fill.failed,
        .progress-fill.cancelled {
          background: #9e9e9e;
        }

        .progress-text {
          color: var(--secondary-text);
          font-size: 12px;
          min-width: 35px;
        }

        .error-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(244, 67, 54, 0.05);
          border-radius: 6px;
          margin-top: 8px;
        }

        .error-label {
          color: #f44336;
          font-size: 12px;
          font-weight: 600;
        }

        .error-value {
          flex: 1;
          color: var(--secondary-text);
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chevron {
          color: var(--secondary-text);
          font-size: 12px;
        }

        .action-buttons {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--green-20);
        }

        .cancel-button {
          width: 100%;
          padding: 10px;
          background: rgba(244, 67, 54, 0.1);
          color: #f44336;
          border: 1px solid rgba(244, 67, 54, 0.3);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .cancel-button:hover:not(:disabled) {
          background: rgba(244, 67, 54, 0.15);
          border-color: rgba(244, 67, 54, 0.5);
        }

        .cancel-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </>
  )
}

export default RunningIntervals