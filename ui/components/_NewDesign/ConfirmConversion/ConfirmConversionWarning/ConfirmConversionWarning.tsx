import React from "react"
import { useTranslation } from "react-i18next"
import SharedInfoTab from "../../../Shared/_newDeisgn/InfoTab/SharedInfoTab"

const ConfirmConversionWarning = () => {
  const { t } = useTranslation()
  
  return (
    <>
      <div className="conversion-warning-wrapper">
        <SharedInfoTab>
          <div className="warning-message">
            {t("confirm_conversion.funds_locked_warning")}{" "}
            <a href="#" className="warning-link">
              {t("confirm_conversion.learn_more")}
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