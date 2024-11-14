import React, { useState, ReactElement } from "react"
import classNames from "classnames"

export type Option = {
  value: string
  label: string
}

type Props = {
  direction: "top" | "bottom"
  options: Option[]
  onSelectOption?: (
    value: Option
  ) => void | React.Dispatch<React.SetStateAction<Option>>
  selectedOption?: Option
  label?: string
  width?: number
}

export default function SharedSelectMenu({
  direction = "bottom",
  options = [],
  onSelectOption = () => {},
  label,
  width,
  selectedOption,
}: Props): ReactElement {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const currentOption = selectedOption ?? options[0]

  const updateSelectedOption = (option: Option) => {
    onSelectOption(option)
    setIsDropdownOpen(false)
  }

  return (
    <>
      <div className="select" style={{ width: width ? `${width}px` : "100%" }}>
        {label && <label>{label}</label>}
        <button
          type="button"
          className="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
        >
          <span>{currentOption?.label || "Select an option"}</span>
          <span className={classNames("icon", { open: isDropdownOpen })} />
        </button>
        {isDropdownOpen && (
          <ul
            className={classNames("options", {
              revertedDirection: direction === "top",
            })}
            style={{ display: "block" }}
          >
            {options.map((option) => (
              <li
                key={option.value}
                className={classNames("option", {
                  selected: option.value === currentOption.value,
                })}
                style={{ display: "block" }}
                onClick={() => updateSelectedOption(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <style jsx>{`
        .select {
          position: relative;
        }

        label {
          color: var(--primary-text);
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 8px;
          margin-top: 0;
          line-height: 18px;
        }

        .button {
          font-weight: 500;
          font-size: 14px;
          line-height: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          width: 100%;
          box-sizing: border-box;
          color: var(--primary-text);
          border: 1px solid var(--tertiary-bg);
          border-radius: 4px;
          cursor: pointer;
          background-color: var(--secondary-bg);
        }

        .button .icon {
          mask-image: url("./images/chevron_down.svg");
          mask-size: 12px 8px;
          background-color: var(--primary-text);
          width: 12px;
          height: 8px;
          transition: transform 0.2s;
        }

        .button .icon.open {
          transform: rotate(180deg);
        }

        .button:hover {
          opacity: 0.8;
        }

        .options {
          position: absolute;
          top: 100%;
          left: 0;
          width: 100%;
          margin-top: 5px;
          box-sizing: border-box;
          background-color: var(--secondary-bg);
          border: 1px solid var(--tertiary-bg);
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          max-height: 365px;
          overflow-y: auto;
          z-index: 1000;
          padding: 4px 4px 0 4px;
        }

        .revertedDirection {
          top: unset;
          bottom: calc(100% - 21px);
          margin-top: 0;
        }

        .option {
          padding: 10px 16px;
          cursor: pointer;
          box-sizing: border-box;
          border-radius: 4px;
          color: var(--primary-text);
          font-weight: 500;
          font-size: 14px;
          line-height: 16px;
          transition: background-color 0.2s;
          width: 100%;
          margin-bottom: 4px;
        }

        .option:hover {
          background-color: var(--tertiary-bg);
        }

        .option.selected {
          background-color: var(--tertiary-bg);
        }
      `}</style>
    </>
  )
}
