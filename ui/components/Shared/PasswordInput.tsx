import React, { ComponentProps, ReactElement, useState } from "react"
import classNames from "classnames"
import { useTranslation } from "react-i18next"
import SharedInput from "./SharedInput"
import { Simplify } from "./types"

type PasswordInputProps = Simplify<
  { hasPreview?: boolean } & Omit<ComponentProps<typeof SharedInput>, "type">
>

export default function PasswordInput(props: PasswordInputProps): ReactElement {
  const { hasPreview = true, ...inputProps } = props
  const [showPassword, setShowPassword] = useState(false)
  const passwordInputType = showPassword ? "text" : "password"
  const { t } = useTranslation("translation", { keyPrefix: "shared" })

  const handleShowButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const nextInput = e.currentTarget.closest('.wrapper')?.nextElementSibling?.querySelector('input');
      if (nextInput) {
        (nextInput as HTMLElement).focus();
      }
    }
  };

  return (
    <div className="wrapper">
      <SharedInput
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...inputProps}
        type={passwordInputType}
      />
      {hasPreview && (
        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          onKeyDown={handleShowButtonKeyDown}
          className="show_button"
          tabIndex={-1}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      )}
      <style jsx>
        {`
          .wrapper > :global(input) {
            padding-right: 70px;
            background: var(--secondary-bg);
            border: 1px solid #333333;
            border-radius: 4px;
            color: var(--primary-text);
            height: 48px;
            font-size: 16px;
          }
          .wrapper {
            position: relative;
            width: 100%;
          }
          .show_button {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #2196F3;
            font-size: 14px;
            cursor: pointer;
            padding: 0;
          }
        `}
      </style>
    </div>
  )
}

const { type: _, ...defaultProps } = SharedInput.defaultProps
PasswordInput.defaultProps = defaultProps
