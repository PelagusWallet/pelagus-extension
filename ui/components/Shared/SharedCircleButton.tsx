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
  width?: string
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
    width,
  } = props

  return (
    <button
      type="button"
      className={!disabled ? "hoverable" : "disabled"}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <div className="button_square">
        <div className="icon" />
        <div className="button_text">{children}</div>
      </div>
      <style jsx>
        {`
          button {
            transition: all 0.2s;
            width: ${width ?? "80%"};
          }
          .hoverable:hover .button_square {
            background-color: var(--hover-bg, var(--secondary-bg));
            filter: brightness(0.95);
          }
          .disabled {
            cursor: not-allowed;
          }
          .disabled .button_square {
            background-color: var(--disabled);
          }
          .button_square {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            border-radius: 16px;
            width: ${size}px;
            height: ${size}px;
            background-color: ${disabled
              ? "var(--disabled)"
              : "var(--secondary-bg)"};
            transition: all 0.2s;
            padding: 8px;
            box-sizing: border-box;
          }
          .icon {
            mask-image: url("./images/${icon}");
            mask-repeat: no-repeat;
            mask-position: center;
            mask-size: cover;
            width: ${`${iconWidth}px` ?? "100%"};
            height: ${`${iconHeight}px` ?? "100%"};
            background-color: ${disabled
              ? "var(--disabled)"
              : "var(--trophy-gold)"};
          }
          .button_text {
            font-size: 12px;
            font-weight: 500;
            line-height: 16px;
            letter-spacing: 0.03em;
            color: ${disabled ? "var(--disabled)" : "var(--primary-text)"};
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
