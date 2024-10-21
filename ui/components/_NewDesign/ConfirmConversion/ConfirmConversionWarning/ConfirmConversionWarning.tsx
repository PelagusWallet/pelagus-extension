import React from "react"
import SharedInfoTab from "../../../Shared/_newDeisgn/InfoTab/SharedInfoTab"

const ConfirmConversionWarning = () => {
  return (
    <>
      <div className="conversion-warning-wrapper">
        <SharedInfoTab>
          <div className="warning-message">
            These funds will be locked for a 14 day period.{" "}
            <a href="#" className="warning-link">
              Learn more
            </a>
          </div>
        </SharedInfoTab>
      </div>

      <style jsx>{`
        .conversion-warning-wrapper {
          margin-bottom: 24px;
        }

        .warning-message,
        .warning-link {
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          margin: 0;
          color: var(--primary-text);
        }

        .warning-link {
          text-decoration: underline;
        }
      `}</style>
    </>
  )
}

export default ConfirmConversionWarning
