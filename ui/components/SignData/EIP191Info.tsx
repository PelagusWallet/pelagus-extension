import React from "react"
import { MessageSigningRequest } from "@pelagus/pelagus-background/utils/signing"
import { useTranslation } from "react-i18next"

const EIP191Info: React.FC<{
  signingData: MessageSigningRequest["signingData"]
  account: string
  internal: boolean
  // FIXME Drop this once new signing flow is final.
  excludeHeader?: boolean
}> = ({ signingData, account, internal, excludeHeader = false }) => {
  const { t } = useTranslation("translation", { keyPrefix: "signing" })
  return (
    <>
      {excludeHeader ? (
        <></>
      ) : (
        <>
          <div className="label header">
            {internal ? t("signatureRequired") : t("dappSignatureRequest")}
          </div>
          <div className="divider" />
        </>
      )}
      <div className="message">
        <div className="message-title">{t("message")}</div>
        <div className="light">{`${signingData}`}</div>
      </div>
      <div className="message">
        <div className="signed">{t("signed")}</div>
        <div>{account ?? "Unknown"}</div>
      </div>
      <style jsx>{`
        .message {
          margin: 16px;
          width: 100%;
          overflow-wrap: anywhere;
          color: --var(green-20);
        }
        .message-title {
          color: var(--green-40);
          margin-bottom: 6px;
        }
        .light {
          white-space: pre-wrap;
        }
        .label {
          color: var(--green-40);
        }
        .header {
          padding: 16px 0;
        }
        .signed {
          margin-bottom: 6px;
        }
      `}</style>
    </>
  )
}
export default EIP191Info
