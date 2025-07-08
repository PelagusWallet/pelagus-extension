import React, { ReactElement } from "react"
import { Trans, useTranslation } from "react-i18next"
import SharedButton from "../../../../components/Shared/SharedButton"

export default function NewSeedIntro({
  onAccept,
}: {
  onAccept: () => void
}): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.newWalletIntro",
  })

  return (
    <section className="step_content fadeIn">
      <h1 className="title">{t("title")}</h1>
      <div className="message">
        <div className="message_content">
          <img 
            src="./images/material-symbols_warning-outline.png" 
            alt="warning" 
            className="warning_icon"
          />
          <p>
            It's important to write down your secret recovery phrase and store it somewhere
            safe. This is the only way to recover your accounts and funds.
          </p>
          <p className="underlined">
            You will not be able to export your recovery phrase later.
          </p>
        </div>
      </div>
      <div className="cta">
        <SharedButton type="primary" size="large" onClick={onAccept} center>
          {t("submit")}
      </SharedButton>
      </div>

      <style jsx>{`
        .step_content {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          max-width: 380px;
          margin: 0 auto;
          gap: 24px;
        }

        .title {
          font-family: "Segment";
          font-size: 24px;
          line-height: 32px;
          color: white;
          margin: 0;
          text-align: center;
        }

        .message {
          background: rgba(33, 150, 243, 0.1);
          border: 1px solid #2196F3;
          border-radius: 4px;
          padding: 16px;
        }

        .message_content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .warning_icon {
          width: 24px;
          height: 24px;
        }

        p {
          margin: 0;
          font-family: "Segment";
          font-size: 16px;
          line-height: 24px;
          color: white;
        }

        .underlined {
          text-decoration: underline;
        }

        :global(button) {
          border-radius: 4px;
        }
      `}</style>
    </section>
  )
}
