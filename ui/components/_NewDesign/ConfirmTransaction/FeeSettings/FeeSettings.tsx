import React, { useState } from "react"

const FeeSettings = () => {
  const [isShowAdvancedSettings, setIsShowAdvancedSettings] = useState(false)

  const [tipValue, setTipValue] = useState("")
  const [tipPlaceholder, setTipPlaceholder] = useState("Enter WEI")

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    const regex = /^[0-9]*\.?[0-9]*$/
    if (value === "" || regex.test(value)) {
      setTipValue(value)
    }
  }

  const onAutoTips = () => {
    setTipValue("")
    setTipPlaceholder("Auto-calculated tip will be applied")
  }
  return (
    <>
      <div>
        <div className="fees">
          <div className="fee-row">
            <p className="fee-row-key">Payment Channel Gas Fee</p>
            <p className="fee-row-value">0.0123 QUAI</p>
          </div>
          <div className="fee-row">
            <p className="fee-row-key">Estimated Fee</p>
            <p className="fee-row-value">0.0123 QI</p>
          </div>
        </div>

        {!isShowAdvancedSettings && (
          <button
            type="button"
            className="advanced-settings"
            onClick={() => setIsShowAdvancedSettings(true)}
          >
            Advanced Settings
          </button>
        )}

        {isShowAdvancedSettings && (
          <>
            <h3 className="tip-label">Miner Tips</h3>
            <div className="tip-wrapper">
              <input
                type="text"
                className="tip-input"
                placeholder={tipPlaceholder}
                value={tipValue}
                onChange={handleInput}
              />
              <button type="button" className="tip-button" onClick={onAutoTips}>
                Auto
              </button>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .fees {
          padding: 16px;
          margin-top: 8px;
          margin-bottom: 12px;
          background: var(--secondary-bg);
          border-radius: 8px;
        }

        .fee-row {
          display: flex;
          justify-content: space-between;
        }

        .fee-row-key {
          margin: 0;
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          color: var(--secondary-text);
        }

        .fee-row-value {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--primary-text);
        }

        .advanced-settings {
          width: 100%;
          display: flex;
          justify-content: center;
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          text-decoration: underline;
          margin-bottom: 22px;
          color: var(--secondary-text);
        }

        .tip-label {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--secondary-text);
        }

        .tip-wrapper {
          position: relative;
        }

        .tip-input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 16px;
          border: 2px solid var(--tertiary-bg);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--primary-text);
        }

        .tip-input:focus {
          background: var(--secondary-bg);
          border-color: var(--accent-color);
        }

        .tip-input:hover {
          border-color: var(--accent-color);
        }

        .tip-input::placeholder {
          color: var(--secondary-text);
        }

        .tip-button {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          padding: 8px 12px;
          font-weight: 700;
          font-size: 12px;
          line-height: 10px;
          color: var(--primary-text);
          background: var(--tertiary-bg);
          border-radius: 176px;
        }
      `}</style>
    </>
  )
}

export default FeeSettings
