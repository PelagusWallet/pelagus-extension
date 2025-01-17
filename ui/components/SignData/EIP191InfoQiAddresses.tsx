import React, { ReactElement, ReactNode } from "react"
import { MessageSigningRequest } from "@pelagus/pelagus-background/utils/signing"
import { useTranslation } from "react-i18next"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import classNames from "classnames"
import { useBackgroundSelector } from "../../hooks"

type DataSignatureDetailsProps = {
  requestingSource?: string | null | undefined
  excludeTitle?: boolean
  children: ReactNode
}

export function DataQiSignatureDetails({
  requestingSource,
  excludeTitle = false,
  children,
}: DataSignatureDetailsProps): ReactElement {
  return (
    <div className="primary_info_card standard_width">
      <div className="sign_block">
        <div className="container">
          {excludeTitle ? (
            <></>
          ) : (
            <div className="label header">
              You are about to sign a message with ALL of your QI addresses.
            </div>
          )}
          <div
            className={classNames({ source: requestingSource !== undefined })}
          >
            {requestingSource}
          </div>
          {children}
        </div>
      </div>
      <style jsx>{`
        .primary_info_card {
          height: fit-content;
          border-radius: 16px;
          background-color: var(--hunter-green);
          margin: 0 0 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .sign_block {
          display: flex;
          width: 100%;
          flex-direction: column;
          justify-content: space-between;
        }
        .container {
          display: flex;
          margin: 15px 20px 15px 25px;
          flex-direction: column;
          align-items: center;
          font-size: 16px;
          line-height: 24px;
        }
        .header,
        .source {
          padding: 5px 0 15px;
          font-size: 16px;
          margin: 0 16px;
          align-self: stretch;
          border-bottom: 1px solid var(--green-120);
          justify-content: center;
          text-align: center;
        }
        .header + .source {
          padding-top: 16px;
        }
        .source {
          font-weight: 500;
          line-height: 24px;
        }
      `}</style>
    </div>
  )
}

const EIP191InfoQiAddresses: React.FC<{
  signingData: MessageSigningRequest["signingData"]
  account: string
  internal: boolean
  // FIXME Drop this once new signing flow is final.
  excludeHeader?: boolean
}> = ({ signingData, account, internal, excludeHeader = false }) => {
  const { t } = useTranslation("translation", { keyPrefix: "signing" })
  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const utxoAccountsByPaymentCode = useBackgroundSelector(
    (state) => state.account.accountsData.utxo[currentNetwork.chainID]
  )

  const utxoAccountArr = Object.values(utxoAccountsByPaymentCode ?? {})[0]

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
        <div className="signed">Qi Payment Code</div>
        <div>{utxoAccountArr?.paymentCode ?? "Unknown"}</div>
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
export default EIP191InfoQiAddresses
