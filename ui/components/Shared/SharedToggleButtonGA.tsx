import React, { useState, ReactElement, useEffect } from "react"
import classNames from "classnames"
import { useTranslation } from "react-i18next"
import SharedTooltip from "./SharedTooltip"

type SharedToggleButtonGAProps = {
  isDisabled?: boolean
  leftToRight?: boolean
  value?: boolean | undefined
  onChange: (toggleValue: boolean) => void
}

export default function SharedToggleButtonGA({
  isDisabled = false,
  leftToRight = true,
  value,
  onChange,
}: SharedToggleButtonGAProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.selectNetwork",
  })

  const [isActive, setIsActive] = useState(value || false)

  useEffect(() => setIsActive(!!value), [value])

  const handleToggleAction = () => onChange(!isActive)

  const ToggleButtonComponent = () => (
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
            background-color: var(--green-95);
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
            background-color: var(--white);
          }
          .disabled {
            opacity: 0.5;
            background-color: var(--disabled);
          }
        `}
      </style>
    </button>
  )

  return (
    <SharedTooltip
      type="dark"
      width={200}
      height={35}
      verticalPosition="top"
      horizontalPosition="left"
      horizontalShift={30}
      disabled={!isDisabled}
      IconComponent={ToggleButtonComponent}
    >
      <div>{t("disabledToggleMessage")}</div>
    </SharedTooltip>
  )
}
