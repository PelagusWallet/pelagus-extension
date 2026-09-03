import React, { ReactElement } from "react"
import SharedButton from "../../components/Shared/SharedButton"
import SharedIcon from "../../components/Shared/SharedIcon"

export default function SettingButton(props: {
  label: string
  ariaLabel: string
  icon: string
  link?: string
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  isLoading?: boolean
}): ReactElement {
  const { link, ariaLabel, label, icon, onClick, isLoading } = props

  return (
    <SharedButton
      type="unstyled"
      size="medium"
      linkTo={link}
      onClick={onClick}
      isLoading={isLoading}
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: "52px",
        position: "relative",
        width: "100%",
      }}
      contentStyle={{
        flex: "1 1 auto",
        minWidth: 0,
        width: "100%",
      }}
    >
      <div className="button_row">
        <div className="action_name">{label}</div>
        <SharedIcon
          icon={`icons/s/${icon}.svg`}
          width={16}
          color="var(--primary-text)"
          ariaLabel={ariaLabel}
        />
        <style jsx>{`
          .action_name {
            color: var(--primary-text);
            font-size: 16px;
            font-weight: 500;
            line-height: 20px;
          }
          .button_row {
            box-sizing: border-box;
            width: 100%;
            align-items: center;
            justify-content: space-between;
            align-content: center;
            display: flex;
          }
          .button_row:hover > .action_name {
            color: var(--secondary-text);
          }
        `}</style>
      </div>
    </SharedButton>
  )
}
