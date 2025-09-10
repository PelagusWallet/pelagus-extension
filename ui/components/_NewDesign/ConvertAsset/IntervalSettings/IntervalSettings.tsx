import React, { useState, useEffect } from "react"
import { useHistory } from "react-router-dom"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import { FaChevronDown, FaChevronUp, FaClock, FaRepeat } from "react-icons/fa6"
import { setIntervalSettings } from "@pelagus/pelagus-background/redux-slices/convertAssets"

const IntervalSettings = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const intervalSettings = useBackgroundSelector((state) => state.convertAssets.intervalSettings)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Local state for input values to allow temporary empty states
  const [transactionCountInput, setTransactionCountInput] = useState(intervalSettings.transactionCount.toString())
  const [intervalMinutesInput, setIntervalMinutesInput] = useState(intervalSettings.intervalMinutes.toString())
  
  // Update local state when Redux state changes
  useEffect(() => {
    setTransactionCountInput(intervalSettings.transactionCount.toString())
  }, [intervalSettings.transactionCount])
  
  useEffect(() => {
    setIntervalMinutesInput(intervalSettings.intervalMinutes.toString())
  }, [intervalSettings.intervalMinutes])

  const handleToggleInterval = () => {
    dispatch(setIntervalSettings({ enabled: !intervalSettings.enabled }))
    if (!intervalSettings.enabled) {
      setIsExpanded(true)
    }
  }

  const handleTransactionCountChange = (value: string) => {
    // Update local state immediately (allows empty string)
    setTransactionCountInput(value)
    
    // Only update Redux if we have a valid number
    const count = parseInt(value)
    if (!isNaN(count) && count > 0) {
      dispatch(setIntervalSettings({ transactionCount: Math.min(100, Math.max(1, count)) }))
    }
  }

  const handleIntervalMinutesChange = (value: string) => {
    // Update local state immediately (allows empty string)
    setIntervalMinutesInput(value)
    
    // Only update Redux if we have a valid number
    const minutes = parseInt(value)
    if (!isNaN(minutes) && minutes > 0) {
      dispatch(setIntervalSettings({ intervalMinutes: Math.min(60, Math.max(1, minutes)) }))
    }
  }
  
  const handleTransactionCountBlur = () => {
    // On blur, if empty or invalid, reset to Redux state value
    const count = parseInt(transactionCountInput)
    if (isNaN(count) || count < 1) {
      setTransactionCountInput(intervalSettings.transactionCount.toString())
    }
  }
  
  const handleIntervalMinutesBlur = () => {
    // On blur, if empty or invalid, reset to Redux state value
    const minutes = parseInt(intervalMinutesInput)
    if (isNaN(minutes) || minutes < 1) {
      setIntervalMinutesInput(intervalSettings.intervalMinutes.toString())
    }
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
                value={transactionCountInput}
                onChange={(e) => handleTransactionCountChange(e.target.value)}
                onBlur={handleTransactionCountBlur}
                onFocus={(e) => {
                  // Select all text for easy replacement
                  setTimeout(() => {
                    e.target.select()
                  }, 0)
                }}
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
                value={intervalMinutesInput}
                onChange={(e) => handleIntervalMinutesChange(e.target.value)}
                onBlur={handleIntervalMinutesBlur}
                onFocus={(e) => {
                  // Select all text for easy replacement
                  setTimeout(() => {
                    e.target.select()
                  }, 0)
                }}
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
          background: var(--secondary-bg);
          border: 1px solid var(--border-dark);
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
          background-color: var(--tertiary-bg);
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
          background-color: var(--secondary-bg);
          border: 1px solid var(--border-dark);
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
          background-color: var(--white);
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: var(--accent-color);
        }

        input:checked + .slider:before {
          transform: translateX(20px);
        }

        .interval-content {
          padding: 0 16px 16px;
          border-top: 1px solid var(--border-dark);
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
          border: 1px solid var(--border-dark);
          border-radius: 6px;
          color: var(--primary-text);
          font-size: 14px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .setting-input:focus {
          outline: none;
          border-color: var(--accent-color);
        }

        .info-box {
          margin-top: 16px;
          padding: 12px;
          background: var(--secondary-bg);
          border: 1px solid var(--border-dark);
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
          border: 1px solid var(--border-dark);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .view-intervals-button:hover {
          background: var(--secondary-bg);
          filter: brightness(1.05);
        }
      `}</style>
    </>
  )
}

export default IntervalSettings
