import React, { useState, ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { setMaxSlippage } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"

const PRESET_OPTIONS = [
  { label: "1%", value: 100 },
  { label: "3%", value: 300 },
  { label: "5%", value: 500 },
]

const MIN_SLIPPAGE = 30 // 0.3%
const MAX_SLIPPAGE = 9000 // 90%

const MaxSlippageSelector = () => {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()
  const maxSlippage = useBackgroundSelector(
    (state) => state.convertAssets.maxSlippage
  )

  const [customValue, setCustomValue] = useState("")
  const [isCustom, setIsCustom] = useState(false)

  // Check if current value matches any preset
  const isPresetValue = PRESET_OPTIONS.some(
    (option) => option.value === maxSlippage
  )

  const handlePresetClick = (value: number) => {
    dispatch(setMaxSlippage(value))
    setIsCustom(false)
  }

  const handleCustomInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value

    // Allow only numbers and decimal point
    if (!/^[0-9]*\.?[0-9]*$/.test(input) && input !== "") {
      return
    }

    setCustomValue(input)
    setIsCustom(true)

    // Convert percentage to basis points
    if (input !== "") {
      const basisPoints = Math.round(parseFloat(input) * 100)

      // Validate range
      if (basisPoints >= MIN_SLIPPAGE && basisPoints <= MAX_SLIPPAGE) {
        dispatch(setMaxSlippage(basisPoints))
      }
    }
  }

  const getPercentageValue = () => {
    return (maxSlippage / 100).toFixed(2)
  }

  return (
    <>
      <section className="max-slippage-wrapper">
        <h3 className="max-slippage-label">{t("convert_slippage.max_slippage")}</h3>
        <div className="max-slippage-options">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`slippage-preset-button ${
                maxSlippage === option.value && !isCustom ? "active" : ""
              }`}
              onClick={() => handlePresetClick(option.value)}
            >
              {option.label}
            </button>
          ))}

          <div
            className={`custom-input-wrapper ${
              isCustom || !isPresetValue ? "active" : ""
            }`}
          >
            <input
              type="text"
              className="custom-slippage-input"
              placeholder={t("convert_slippage.custom")}
              value={isCustom ? customValue : ""}
              onChange={handleCustomInputChange}
              onFocus={() => {
                setIsCustom(true)
                setCustomValue(getPercentageValue())
              }}
            />
            <span className="percentage-symbol">%</span>
          </div>
        </div>

        {/* Display warnings if needed */}
        {maxSlippage < MIN_SLIPPAGE && isCustom && (
          <p className="slippage-warning">{t("convert_slippage.min_slippage_warning")}</p>
        )}
        {maxSlippage > MAX_SLIPPAGE && isCustom && (
          <p className="slippage-warning">{t("convert_slippage.max_slippage_warning")}</p>
        )}
      </section>

      <style jsx>{`
        .max-slippage-wrapper {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
          width: 100%;
        }

        .max-slippage-label {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--secondary-text);
        }

        .max-slippage-options {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .slippage-preset-button {
          flex: 1;
          padding: 8px 12px;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--primary-text);
          background: var(--tertiary-bg);
          border-radius: 8px;
          border: 1px solid transparent;
          min-width: 0;
          text-align: center;
        }

        .slippage-preset-button.active {
          border-color: var(--primary);
          background: var(--primary-10);
        }

        .custom-input-wrapper {
          flex: 1.5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--tertiary-bg);
          border-radius: 8px;
          border: 1px solid transparent;
        }

        .custom-input-wrapper.active {
          border-color: var(--primary);
          background: var(--primary-10);
        }

        .custom-slippage-input {
          width: 85%;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--primary-text);
          background: transparent;
          text-align: right;
        }

        .percentage-symbol {
          color: var(--primary-text);
          font-size: 14px;
          font-weight: 500;
          margin-left: 4px;
        }

        .slippage-warning {
          margin: 4px 0 0;
          font-size: 12px;
          line-height: 16px;
          color: var(--error);
        }
      `}</style>
    </>
  )
}

export default MaxSlippageSelector
