import React, { useState, ReactElement, useEffect } from "react"
import classNames from "classnames"

type SharedToggleButtonProps = {
  onChange: (toggleValue: boolean) => void
  onColor?: string
  offColor?: string
  value?: boolean | undefined
  leftToRight: boolean
}

export default function SharedToggleButton({
  onChange,
  value,
  leftToRight,
}: SharedToggleButtonProps): ReactElement {
  const [isActive, setIsActive] = useState(value || false)

  useEffect(() => {
    setIsActive(!!value)
  }, [value])

  const handleToggleAction = () => {
    onChange(!isActive)
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isActive}
      className={classNames("container", { is_active: isActive })}
      onClick={handleToggleAction}
    >
      <div className="bulb" />
      <style jsx>
        {`
          .container {
            width: 40px;
            height: 24px;
            border-radius: 20px;
            background-color: var(--green-120);
            box-sizing: border-box;
            padding: 3px;
            cursor: pointer;
            display: flex;
            border: 1px solid var(--hunter-green)
              ${leftToRight ? "" : "transform: rotate(180deg);"};
          }
          .bulb {
            width: 16px;
            height: 16px;
            border-radius: 20px;
            background-color: var(--hunter-green);
            transition: 0.2s ease-in-out;

            box-shadow: 0 1px 1px rgba(0, 20, 19, 0.3);
          }
          .is_active .bulb {
            transform: translateX(16px);
          }
          .is_active {
            background-color: var(--green-80);
          }
        `}
      </style>
    </button>
  )
}

SharedToggleButton.defaultProps = {
  leftToRight: true,
}
