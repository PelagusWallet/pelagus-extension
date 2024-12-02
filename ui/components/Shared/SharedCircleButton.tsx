import React, { ReactElement } from "react"

const SIZE = 60
const DEFAULT_COLORS: ColorDetails = {
  color: "var(--green-40)",
  hoverColor: "var(--gold-80)",
}

type ColorDetails = {
  color: string
  hoverColor: string
}

type Props = {
  icon: string
  iconColor: ColorDetails
  iconHeight?: string
  iconWidth?: string
  textColor: ColorDetails
  disabled?: boolean
  size: number
  ariaLabel?: string
  children: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export default function SharedCircleButton(props: Props): ReactElement {
  const {
    icon,
    iconColor,
    iconHeight,
    iconWidth,
    textColor,
    size,
    ariaLabel,
    children,
    disabled,
    onClick,
  } = props

  return (
    <button
      type="button"
      className={!disabled ? "hoverable" : "disabled"}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <div className="icon_wrap">
        <div className="icon" />
      </div>
      <div>{children}</div>
      <style jsx>
        {`
          button {
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
            letter-spacing: 0.03em;
            color: ${textColor.color};
            transition: color 0.2s;
            width: 80%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
          }
          .hoverable:hover {
            color: ${textColor.hoverColor};
          }
          .disabled {
            color: var(--disabled);
            cursor: not-allowed;
          }
          .icon_wrap {
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            width: ${size}px;
            height: ${size}px;
            background-color: ${disabled
              ? "var(--disabled)"
              : "var(--trophy-gold)"};
            transition: background-color 0.2s;
          }
          .hoverable:hover .icon_wrap {
            background-color: ${iconColor.hoverColor};
          }
          .icon {
            mask-image: url("./images/${icon}");
            mask-repeat: no-repeat;
            mask-position: center;
            mask-size: cover;
            width: ${`${iconWidth}px` ?? "100%"};
            height: ${`${iconHeight}px` ?? "100%"};
            background-color: var(--hunter-green);
          }
        `}
      </style>
    </button>
  )
}

SharedCircleButton.defaultProps = {
  iconColor: DEFAULT_COLORS,
  textColor: DEFAULT_COLORS,
  size: SIZE,
}
