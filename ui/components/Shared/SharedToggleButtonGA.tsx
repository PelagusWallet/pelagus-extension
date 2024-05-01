import React, { useState, ReactElement, useEffect } from "react"
import classNames from "classnames"

type SharedToggleButtonGAProps = {
  onChange: (toggleValue: boolean) => void
  value?: boolean | undefined
  /**
   * True if the toggle is off when on the left and on when on the right, false
   * if the direction is opposite (on when on the left and off when on the
   * right). True by default.
   */
  leftToRight?: boolean
  isDisabled?: boolean
}

export default function SharedToggleButtonGA({
  onChange,
  value,
  leftToRight = true,
  isDisabled = false,
}: SharedToggleButtonGAProps): ReactElement {
  const [isActive, setIsActive] = useState(value || false)

  useEffect(() => setIsActive(!!value), [value])

  const handleToggleAction = () => onChange(!isActive)

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isActive}
      disabled={isDisabled}
      className={classNames("container", {
        is_active: isActive,
        disabled: isDisabled,
      })}
      onClick={handleToggleAction}
    >
      <div className="bulb" />
      <style jsx>
        {`
          .container {
            width: 28px;
            height: 18px;
            border-radius: 20px;
            background-color: var(--green-120);
            box-sizing: border-box;
            padding: 1px;
            cursor: pointer;
            display: flex;
            border: 1px solid var(--hunter-green)
              ${leftToRight ? "" : "transform: rotate(180deg);"};
          }
          .bulb {
            width: 14px;
            height: 14px;
            border-radius: 20px;
            background-color: var(--hunter-green);
            transition: 0.2s ease-in-out;

            box-shadow: 0px 1px 1px rgba(0, 20, 19, 0.3);
          }
          .is_active .bulb {
            transform: translateX(10px);
          }
          .is_active {
            background-color: var(--green-80);
          }
          .disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background-color: var(--disabled);
          }
        `}
      </style>
    </button>
  )
}
