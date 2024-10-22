import React from "react"
import classNames from "classnames"
import SharedLoadingSpinner from "../../SharedLoadingSpinner"

const SharedConfirmButton = ({
  title = "",
  onClick = () => {},
  isConfirmDisabled = false,
  isLoading = false,
}: {
  title?: string
  onClick?: () => void
  isConfirmDisabled?: boolean
  isLoading?: boolean
}) => {
  return (
    <>
      <button
        type="button"
        className={classNames("button", {
          disabled: isConfirmDisabled || isLoading,
        })}
        onClick={() => {
          if (isConfirmDisabled || isLoading) return
          onClick()
        }}
      >
        <>
          <span>{title}</span>
          {isLoading && <SharedLoadingSpinner size="small" />}
        </>
      </button>

      <style jsx>{`
        .button:hover {
          opacity: 90%;
        }

        .button {
          width: 100%;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          padding: 10px 0;
          border-radius: 4px;
          border: 1px solid var(--accent-color);
          background: var(--accent-color);
          color: var(--contrast-text);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }

        .disabled {
          background: var(--secondary-bg);
          color: var(--secondary-text);
          border: 1px solid var(--secondary-bg);
          cursor: not-allowed;
        }

        .disabled:hover {
          opacity: 1;
        }
      `}</style>
    </>
  )
}

export default SharedConfirmButton
