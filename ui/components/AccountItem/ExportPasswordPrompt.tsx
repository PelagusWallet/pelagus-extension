import React, { ReactElement } from "react"
import PasswordInput from "../Shared/PasswordInput"
import SharedButton from "../Shared/SharedButton"

type ExportPasswordPromptProps = {
  title: string
  description?: string
  password: string
  errorMessage?: string
  confirmLabel?: string
  onPasswordChange: (password: string) => void
  onConfirm: () => void
  onBack: () => void
}

export default function ExportPasswordPrompt({
  title,
  description,
  password,
  errorMessage,
  confirmLabel = "Confirm",
  onPasswordChange,
  onConfirm,
  onBack,
}: ExportPasswordPromptProps): ReactElement {
  return (
    <li className="account_container">
      <div className="item-summary">
        <div className="title">{title}</div>
        {description ? <div className="description">{description}</div> : null}
        <div className="password_input_container">
          <PasswordInput
            id="export_wallet_password"
            label="Wallet password"
            value={password}
            onChange={(value) => onPasswordChange(value ?? "")}
            errorMessage={errorMessage}
            focusedLabelBackgroundColor="var(--secondary-bg)"
          />
        </div>
        <div className="button_container">
          <SharedButton type="secondary" size="small" onClick={() => onBack()}>
            Back
          </SharedButton>
          <SharedButton
            type="primary"
            size="small"
            onClick={() => onConfirm()}
            isDisabled={!password}
          >
            {confirmLabel}
          </SharedButton>
        </div>
      </div>
      <style jsx>{`
        .account_container {
          margin-top: -10px;
          padding: 5px;
          border-radius: 16px;
          width: 336px;
        }
        .item-summary {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          padding: 2px;
        }
        .title {
          color: var(--trophy-gold);
          font-size: 18px;
          font-weight: 600;
        }
        .description {
          color: var(--secondary-text);
          font-size: 14px;
          line-height: 20px;
        }
        .password_input_container {
          width: 100%;
        }
        .button_container {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
        }
        .button_container :global(button.button) {
          flex: 1;
        }
      `}</style>
    </li>
  )
}
