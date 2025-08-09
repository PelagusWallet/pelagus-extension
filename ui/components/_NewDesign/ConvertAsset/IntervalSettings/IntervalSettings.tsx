import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import { FaChevronDown, FaChevronUp, FaClock, FaRepeat } from "react-icons/fa6"
import { setIntervalSettings } from "@pelagus/pelagus-background/redux-slices/convertAssets"

const IntervalSettings = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const intervalSettings = useBackgroundSelector((state) => state.convertAssets.intervalSettings)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggleInterval = () => {
    dispatch(setIntervalSettings({ enabled: !intervalSettings.enabled }))
    if (!intervalSettings.enabled) {
      setIsExpanded(true)
    }
  }

  const handleTransactionCountChange = (value: string) => {
    const count = parseInt(value) || 1
    dispatch(setIntervalSettings({ transactionCount: Math.min(100, Math.max(1, count)) }))
  }

  const handleIntervalMinutesChange = (value: string) => {
    const minutes = parseInt(value) || 1
    dispatch(setIntervalSettings({ intervalMinutes: Math.min(60, Math.max(1, minutes)) }))
  }

  return (
    <>
      <div className="interval-settings-container">
        <div className="interval-header" onClick={() => handleToggleInterval()}>
          <div className="header-left">
            <FaClock className="icon" />
            <span className="title">Interval Conversion</span>
          </div>
          <div className="header-right">
            <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={intervalSettings.enabled}
                onChange={handleToggleInterval}
              />
              <span className="slider"></span>
            </label>
            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
          </div>
        </div>

        {isExpanded && intervalSettings.enabled && (
          <div className="interval-content">
            <div className="setting-group">
              <label className="setting-label">
                <FaRepeat className="label-icon" />
                Number of Transactions
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={intervalSettings.transactionCount}
                onChange={(e) => handleTransactionCountChange(e.target.value)}
                className="setting-input"
              />
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <FaClock className="label-icon" />
                Interval (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={intervalSettings.intervalMinutes}
                onChange={(e) => handleIntervalMinutesChange(e.target.value)}
                className="setting-input"
              />
            </div>

            <div className="info-box">
              <p className="info-text">
                This will execute {intervalSettings.transactionCount} transaction{intervalSettings.transactionCount !== 1 ? "s" : ""} in total, with one every {intervalSettings.intervalMinutes} minute{intervalSettings.intervalMinutes !== 1 ? "s" : ""}.
              </p>
              <p className="info-text-secondary">
                You can view and cancel running intervals from the intervals page.
              </p>
            </div>
            
            <button 
              className="view-intervals-button"
              onClick={(e) => {
                e.stopPropagation()
                history.push("/intervals")
              }}
            >
              View Running Intervals
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .interval-settings-container {
          background: var(--hunter-green);
          border: 1px solid var(--green-40);
          border-radius: 8px;
          margin: 16px 0;
          overflow: hidden;
        }

        .interval-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .interval-header:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon {
          color: var(--primary-text);
          font-size: 16px;
        }

        .title {
          color: var(--primary-text);
          font-size: 14px;
          font-weight: 500;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--green-20);
          transition: 0.3s;
          border-radius: 24px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: var(--success);
        }

        input:checked + .slider:before {
          transform: translateX(20px);
        }

        .interval-content {
          padding: 0 16px 16px;
          border-top: 1px solid var(--green-20);
        }

        .setting-group {
          margin-top: 16px;
        }

        .setting-label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--secondary-text);
          font-size: 13px;
          margin-bottom: 8px;
        }

        .label-icon {
          font-size: 12px;
        }

        .setting-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--green-20);
          border-radius: 6px;
          color: var(--primary-text);
          font-size: 14px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .setting-input:focus {
          outline: none;
          border-color: var(--green-40);
        }

        .info-box {
          margin-top: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
        }

        .info-text {
          color: var(--primary-text);
          font-size: 13px;
          margin: 0 0 8px 0;
        }

        .info-text-secondary {
          color: var(--secondary-text);
          font-size: 12px;
          margin: 0;
          font-style: italic;
        }

        .view-intervals-button {
          width: 100%;
          margin-top: 12px;
          padding: 10px;
          background: transparent;
          color: var(--primary-text);
          border: 1px solid var(--green-40);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .view-intervals-button:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--green-60);
        }
      `}</style>
    </>
  )
}

export default IntervalSettings