import React, { useState, ReactElement, useEffect } from "react"
import classNames from "classnames"

type SharedToggleButtonProps = {
  onChange: (toggleValue: boolean) => void
  /**
   * The color of the toggle bulb when the toggle is on. Any valid CSS color
   * (including a `var` expression) can be used.
   */
  onColor?: string
  /**
   * The color of the toggle bulb when the toggle is off. Any valid CSS color
   * (including a `var` expression) can be used.
   */
  offColor?: string
  value?: boolean | undefined
  /**
   * True if the toggle is off when on the left and on when on the right, false
   * if the direction is opposite (on when on the left and off when on the
   * right). True by default.
   */
  leftToRight: boolean
}

export default function SharedToggleButton({
  onChange,
  onColor,
  offColor,
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

            box-shadow: 0px 1px 1px rgba(0, 20, 19, 0.3);
          }
          .is_active .bulb {
            transform: translateX(16px);
          }
          .is_active {
            background-color: var(--green-80); // This line was added
          }
        `}
      </style>
    </button>
  )
}

SharedToggleButton.defaultProps = {
  leftToRight: true,
}
