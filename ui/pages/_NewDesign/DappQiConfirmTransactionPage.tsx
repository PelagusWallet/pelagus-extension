import React, { ReactElement, useEffect, useRef, useState } from "react"
import { useHistory } from "react-router-dom"
import {
  rejectDappQiTransaction,
  sendDappQiTransaction,
} from "@pelagus/pelagus-background/redux-slices/qiSend"
import { NormalizedQiSendToOutputsRequest } from "@pelagus/pelagus-background/services/transactions/types"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { useTranslation } from "react-i18next"
import { denominations, formatQi } from "quais"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"

interface AsyncThunkResult {
  txHash?: string
  error?: { message: string }
}

const formatQit = (value: string, fallbackUnit: string) => {
  try {
    return `${formatQi(BigInt(value))} QI`
  } catch (_) {
    return `${value} ${fallbackUnit}`
  }
}

function CopyableValue({
  label,
  value,
  copyLabel,
}: {
  label: string
  value: string
  copyLabel: string
}) {
  const copy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(() => undefined)
    }
  }

  return (
    <div className="copyable-value">
      <span>{label}</span>
      <code>{value}</code>
      <button
        type="button"
        onClick={copy}
        aria-label={`${copyLabel}: ${label}`}
      >
        {copyLabel}
      </button>
      <style jsx>{`
        .copyable-value {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 5px 10px;
          min-width: 0;
          padding: 10px 0;
        }
        span {
          grid-column: 1 / -1;
          color: var(--secondary-text);
          font-size: 12px;
          line-height: 16px;
          font-weight: 500;
        }
        code {
          min-width: 0;
          color: var(--primary-text);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
          font-size: 12px;
          line-height: 18px;
          overflow-wrap: anywhere;
          white-space: normal;
        }
        button {
          align-self: start;
          min-width: 48px;
          min-height: 44px;
          margin-top: -8px;
          padding: 0 8px;
          color: var(--gold-80);
          font-size: 12px;
          font-weight: 600;
        }
        button:focus-visible {
          outline: 2px solid var(--gold-80);
          outline-offset: 2px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  )
}

const formatDenomination = (denomination: number, fallbackUnit: string) => {
  const qitValue = denominations[denomination]
  if (qitValue === undefined) return `${fallbackUnit} ${denomination}`
  return formatQit(BigInt(qitValue).toString(), fallbackUnit)
}

function DappQiTransactionDetails({
  request,
  networkName,
  now,
}: {
  request: NormalizedQiSendToOutputsRequest
  networkName: string
  now: number
}) {
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation.dappQi",
  })

  const { prepared } = request
  const dappDeadlineExpired = Boolean(
    request.validUntil !== undefined && request.validUntil <= now
  )
  const preparedExpired = Boolean(prepared && prepared.expiresAt <= now)

  return (
    <>
      <section className="dapp-qi">
        <header>
          <p className="eyebrow">{t("title")}</p>
          <h1>{formatQit(request.amountQit, t("qitUnit"))}</h1>
          {request.origin && (
            <p className="origin">
              {t("requestedBy", { origin: request.origin })}
            </p>
          )}
        </header>

        {!prepared && (
          <p className="warning" role="alert">
            {t("preparedMissing")}
          </p>
        )}
        {dappDeadlineExpired && (
          <p className="warning" role="alert">
            {t("dappDeadlineExpired")}
          </p>
        )}
        {!dappDeadlineExpired && preparedExpired && (
          <p className="warning" role="alert">
            {t("preparedExpired")}
          </p>
        )}

        {prepared && (
          <section className="summary" aria-labelledby="exact-summary-title">
            <h2 id="exact-summary-title">{t("exactTransactionTitle")}</h2>
            <div className="summary-grid">
              <div>
                <span>{t("totalDebitLabel")}</span>
                <b>{formatQit(prepared.totalDebitQit, t("qitUnit"))}</b>
              </div>
              <div>
                <span>{t("feeLabel")}</span>
                <b>{formatQit(prepared.feeQit, t("qitUnit"))}</b>
              </div>
              <div>
                <span>{t("feeCapLabel")}</span>
                <b>{formatQit(prepared.maxFeeQit, t("qitUnit"))}</b>
              </div>
              <div>
                <span>{t("preparedExpiryLabel")}</span>
                <b>{new Date(prepared.expiresAt).toLocaleString()}</b>
              </div>
              {request.validUntil !== undefined && (
                <div className="funding-deadline">
                  <span>{t("dappDeadlineLabel")}</span>
                  <b>{new Date(request.validUntil).toLocaleString()}</b>
                </div>
              )}
            </div>
            {request.validUntil !== undefined && (
              <p className="deadline-note">{t("dappDeadlineNotice")}</p>
            )}
          </section>
        )}

        <section className="section" aria-labelledby="recipients-title">
          <h2 id="recipients-title">{t("recipientOutputsTitle")}</h2>
          <div className="outputs">
            {request.outputs.map((output) => (
              <div
                className="output"
                key={`${output.address}:${output.denomination}`}
              >
                <div className="output-address">
                  <CopyableValue
                    label={t("toLabel")}
                    value={output.address}
                    copyLabel={t("copyLabel")}
                  />
                </div>
                <div className="output-amount">
                  <b>{formatDenomination(output.denomination, t("qitUnit"))}</b>
                  <span>
                    {t("denomination", { denomination: output.denomination })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {prepared && prepared.changeOutputs.length > 0 && (
          <section className="section" aria-labelledby="change-title">
            <h2 id="change-title">{t("changeOutputsTitle")}</h2>
            <p className="section-note">{t("walletChangeNotice")}</p>
            <div className="outputs">
              {prepared.changeOutputs.map((output) => (
                <div
                  className="output"
                  key={`${output.address}:${output.denomination}`}
                >
                  <div className="output-address">
                    <CopyableValue
                      label={t("changeAddressLabel")}
                      value={output.address}
                      copyLabel={t("copyLabel")}
                    />
                  </div>
                  <div className="output-amount">
                    <b>
                      {formatDenomination(output.denomination, t("qitUnit"))}
                    </b>
                    <span>
                      {t("denomination", {
                        denomination: output.denomination,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {prepared && (
          <section className="section" aria-labelledby="source-title">
            <h2 id="source-title">{t("sourceTitle")}</h2>
            <div className="detail">
              <span>{t("accountLabel")}</span>
              <b>{prepared.sourceAccount}</b>
            </div>
            <CopyableValue
              label={t("paymentCodeLabel")}
              value={prepared.sourcePaymentCode}
              copyLabel={t("copyLabel")}
            />
          </section>
        )}

        <section className="section details" aria-labelledby="network-title">
          <h2 id="network-title">{t("networkDetailsTitle")}</h2>
          <div className="detail">
            <span>{t("networkLabel")}</span>
            <b>{networkName}</b>
          </div>
          <div className="detail">
            <span>{t("chainIdLabel")}</span>
            <b>{request.chainId}</b>
          </div>
        </section>

        {(request.label || request.tradeHash || request.data) && (
          <section
            className="section site-metadata"
            aria-labelledby="site-data-title"
          >
            <h2 id="site-data-title">{t("siteMetadataTitle")}</h2>
            <p className="warning">{t("siteMetadataWarning")}</p>
            {request.label && (
              <CopyableValue
                label={t("actionLabel")}
                value={request.label}
                copyLabel={t("copyLabel")}
              />
            )}
            {request.tradeHash && (
              <CopyableValue
                label={t("referenceLabel")}
                value={request.tradeHash}
                copyLabel={t("copyLabel")}
              />
            )}
            {request.data && (
              <CopyableValue
                label={t("dataLabel")}
                value={request.data}
                copyLabel={t("copyLabel")}
              />
            )}
          </section>
        )}

        {prepared && (
          <details className="advanced">
            <summary>{t("advancedLabel")}</summary>
            <CopyableValue
              label={t("digestLabel")}
              value={prepared.digest}
              copyLabel={t("copyLabel")}
            />
            <CopyableValue
              label={t("requestFingerprintLabel")}
              value={prepared.requestFingerprint}
              copyLabel={t("copyLabel")}
            />
            <h3>{t("inputsTitle")}</h3>
            {prepared.inputs.map((input, index) => (
              <div className="input" key={`${input.txhash}:${input.index}`}>
                <p>{t("inputLabel", { index: index + 1 })}</p>
                <CopyableValue
                  label={t("inputAddressLabel")}
                  value={input.address}
                  copyLabel={t("copyLabel")}
                />
                <div className="detail">
                  <span>{t("inputValueLabel")}</span>
                  <b>{formatQit(input.valueQit, t("qitUnit"))}</b>
                </div>
                <div className="detail">
                  <span>{t("inputLockLabel")}</span>
                  <b>{input.lock ?? 0}</b>
                </div>
                <CopyableValue
                  label={t("outpointLabel")}
                  value={`${input.txhash}:${input.index}`}
                  copyLabel={t("copyLabel")}
                />
              </div>
            ))}
          </details>
        )}
      </section>
      <style jsx>{`
        .dapp-qi {
          max-height: calc(100vh - 174px);
          padding: 20px 16px 28px;
          margin: 8px 0 14px;
          box-sizing: border-box;
          border-radius: 8px;
          background: var(--secondary-bg);
          overflow-y: auto;
        }
        .eyebrow {
          margin: 0;
          color: var(--secondary-text);
          font-size: 12px;
          line-height: 18px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .origin,
        .section-note,
        .deadline-note,
        .warning {
          margin: 0;
          color: var(--secondary-text);
          font-size: 12px;
          line-height: 18px;
          overflow-wrap: anywhere;
        }
        .warning {
          margin-top: 12px;
          padding: 10px 12px;
          border-left: 3px solid var(--gold-80);
          background: var(--tertiary-bg);
          color: var(--primary-text);
        }
        .deadline-note {
          margin-top: 10px;
          color: var(--primary-text);
        }
        .funding-deadline {
          border: 1px solid var(--gold-80);
        }
        .section,
        .summary,
        .advanced {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--tertiary-bg);
        }
        h2,
        h3 {
          margin: 0 0 8px;
          color: var(--primary-text);
          font-size: 14px;
          line-height: 20px;
          font-weight: 600;
        }
        h3 {
          margin-top: 14px;
          font-size: 13px;
        }
        .detail {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
          padding: 7px 0;
        }
        h1 {
          margin: 4px 0;
          color: var(--primary-text);
          font-size: 28px;
          line-height: 34px;
          font-weight: 600;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .summary-grid div {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          padding: 10px;
          border-radius: 6px;
          background: var(--tertiary-bg);
        }
        .summary-grid span {
          color: var(--secondary-text);
          font-size: 11px;
          line-height: 15px;
        }
        .summary-grid b {
          color: var(--primary-text);
          font-size: 13px;
          line-height: 18px;
          overflow-wrap: anywhere;
        }
        .outputs {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .output {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 6px 0;
          border-bottom: 1px solid var(--tertiary-bg);
          color: var(--primary-text);
          font-size: 13px;
        }
        .output-address,
        .output-amount {
          min-width: 0;
        }
        .output-amount span,
        .detail span {
          color: var(--secondary-text);
          font-size: 12px;
          line-height: 16px;
          font-weight: 500;
        }
        .output-amount b,
        .detail b {
          color: var(--primary-text);
          font-size: 14px;
          line-height: 20px;
          font-weight: 600;
        }
        .detail b {
          overflow-wrap: anywhere;
        }
        .output-amount {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-end;
          text-align: right;
          white-space: nowrap;
        }
        .site-metadata .warning {
          margin: 0 0 4px;
        }
        .advanced summary {
          min-height: 44px;
          color: var(--primary-text);
          font-size: 14px;
          line-height: 44px;
          font-weight: 600;
          cursor: pointer;
        }
        .advanced summary:focus-visible {
          outline: 2px solid var(--gold-80);
          outline-offset: 2px;
        }
        .input {
          padding: 8px 10px;
          margin-top: 8px;
          border-radius: 6px;
          background: var(--tertiary-bg);
        }
        .input p {
          margin: 0;
          color: var(--primary-text);
          font-size: 12px;
          font-weight: 600;
        }
        @media (max-width: 360px) {
          .summary-grid,
          .output {
            grid-template-columns: 1fr;
          }
          .output-amount {
            align-items: flex-start;
            text-align: left;
          }
        }
      `}</style>
    </>
  )
}

function NoPendingDappRequest() {
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation.dappQi",
  })

  return (
    <>
      <section className="dapp-qi">
        <p className="eyebrow">{t("title")}</p>
        <h1>{t("noPending")}</h1>
      </section>
      <style jsx>{`
        .dapp-qi {
          padding: 20px 16px;
          margin: 8px 0 14px;
          border-radius: 8px;
          background: var(--secondary-bg);
        }
        .eyebrow {
          margin: 0;
          color: var(--secondary-text);
          font-size: 12px;
          line-height: 18px;
          font-weight: 500;
        }
        h1 {
          margin: 4px 0 0;
          color: var(--primary-text);
          font-size: 20px;
          line-height: 26px;
          font-weight: 600;
        }
      `}</style>
    </>
  )
}

const DappQiConfirmTransactionPage = (): ReactElement => {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const network = useBackgroundSelector(selectCurrentNetwork)
  const blockExplorerUrl = network.blockExplorerURL
  const dappRequest = useBackgroundSelector((state) => state.qiSend.dappRequest)

  const { t: confirmationLocales } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation",
  })

  const [isOpenConfirmationModal, setIsOpenConfirmationModal] = useState(false)
  const [isConfirmLoading, setIsConfirmLoading] = useState(false)
  const [isTransactionError, setIsTransactionError] = useState(false)
  const [transactionHash, setTransactionHash] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [now, setNow] = useState(() => Date.now())
  const isSubmittingRef = useRef(false)
  const isCancellingRef = useRef(false)
  const activeDappRequestIdRef = useRef<string | undefined>(undefined)
  const dispatchRef = useRef(dispatch)

  // Keep lifecycle handlers scoped to the currently rendered dapp request.
  // A route/history change can unmount this screen without invoking either
  // button, and a popup close triggers beforeunload without a React click.
  activeDappRequestIdRef.current = dappRequest?.requestId
  dispatchRef.current = dispatch

  useEffect(() => {
    const rejectPendingRequestOnExit = () => {
      // Once Send has started, the wallet may already be broadcasting. Do not
      // tell the dapp the user rejected it; the send thunk will settle with the
      // real result. Otherwise, a disappearing confirmation must reject its
      // exact request so the provider promise cannot hang.
      if (isSubmittingRef.current || isCancellingRef.current) return

      const requestId = activeDappRequestIdRef.current
      if (!requestId) return

      isCancellingRef.current = true
      dispatchRef.current(rejectDappQiTransaction({ requestId }))
    }

    window.addEventListener("beforeunload", rejectPendingRequestOnExit)
    return () => {
      window.removeEventListener("beforeunload", rejectPendingRequestOnExit)
      rejectPendingRequestOnExit()
    }
  }, [])

  const effectiveExpiry = dappRequest?.prepared
    ? Math.min(
        dappRequest.prepared.expiresAt,
        dappRequest.validUntil ?? Number.MAX_SAFE_INTEGER
      )
    : dappRequest?.validUntil

  useEffect(() => {
    if (!effectiveExpiry) return undefined
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [effectiveExpiry])

  const closeDappPopup = () => {
    window.close()
    history.push("/")
  }

  /**
   * This popup owns a promise held by the dapp. Browser back navigation alone
   * would unmount the page without settling that promise. Capture the current
   * request id and reject it before closing; the ref makes header Back and the
   * action-button Back idempotent when clicked in quick succession.
   */
  const cancelDappQiRequest = () => {
    if (isSubmittingRef.current || isCancellingRef.current) return
    isCancellingRef.current = true

    const requestId = dappRequest?.requestId
    if (!requestId) {
      closeDappPopup()
      return
    }

    dispatch(rejectDappQiTransaction({ requestId })).finally(closeDappPopup)
  }

  const onSendQiTransaction = async () => {
    if (
      !dappRequest?.prepared ||
      dappRequest.prepared.expiresAt <= Date.now() ||
      (dappRequest.validUntil !== undefined &&
        dappRequest.validUntil <= Date.now()) ||
      isSubmittingRef.current ||
      isCancellingRef.current
    )
      return
    isSubmittingRef.current = true

    setIsConfirmLoading(true)
    setIsTransactionError(false)
    setTransactionHash("")

    try {
      const result = (await dispatch(
        sendDappQiTransaction()
      )) as AsyncThunkResult
      if (result?.txHash) {
        setTransactionHash(result.txHash)
      } else {
        if (result?.error) {
          setErrorMessage(result.error.message)
        }
        setIsTransactionError(true)
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : confirmationLocales("send.errorSubtitle")
      )
      setIsTransactionError(true)
    } finally {
      setIsConfirmLoading(false)
      setIsOpenConfirmationModal(true)
      isSubmittingRef.current = false
    }
  }

  const confirmationModalProps = isTransactionError
    ? {
        headerTitle: confirmationLocales("send.errorHeadline"),
        subtitle: errorMessage || confirmationLocales("send.errorSubtitle"),
        title: `${confirmationLocales("send.errorTitle")}!`,
        icon: {
          src: "icons/s/notif-wrong.svg",
          height: "43",
          width: "43",
          color: "var(--error-color)",
          padding: "32px",
        },
        isOpen: isOpenConfirmationModal,
        onClose: closeDappPopup,
      }
    : {
        headerTitle: confirmationLocales("sendQi.headerTitle"),
        title: confirmationLocales("sendQi.title"),
        link: {
          text: confirmationLocales("viewTransaction"),
          url: `${blockExplorerUrl}/tx/${transactionHash}`,
        },
        isOpen: isOpenConfirmationModal,
        onClose: closeDappPopup,
      }

  const preparedIsCurrent = Boolean(
    dappRequest?.prepared &&
      dappRequest.prepared.expiresAt > now &&
      (dappRequest.validUntil === undefined || dappRequest.validUntil > now)
  )

  return (
    <>
      <main className="confirm-transaction-wrapper">
        <SharedGoBackPageHeader
          title={confirmationLocales("dappQi.headerTitle")}
          onBack={cancelDappQiRequest}
          preventNavigation
        />
        {dappRequest ? (
          <DappQiTransactionDetails
            request={dappRequest}
            networkName={network.baseAsset.name}
            now={now}
          />
        ) : (
          <NoPendingDappRequest />
        )}
        <SharedActionButtons
          title={{
            confirmTitle: dappRequest
              ? confirmationLocales("dappQi.sendButton", {
                  amount: formatQit(
                    dappRequest.amountQit,
                    confirmationLocales("dappQi.qitUnit")
                  ),
                })
              : confirmationLocales("dappQi.closeButton"),
            cancelTitle: confirmationLocales("dappQi.backButton"),
          }}
          isConfirmDisabled={Boolean(dappRequest) && !preparedIsCurrent}
          onClick={{
            onConfirm: dappRequest ? onSendQiTransaction : closeDappPopup,
            onCancel: cancelDappQiRequest,
          }}
          isLoading={isConfirmLoading}
        />
      </main>

      <SharedConfirmationModal
        headerTitle={confirmationModalProps.headerTitle}
        title={confirmationModalProps.title}
        subtitle={confirmationModalProps.subtitle}
        isOpen={confirmationModalProps.isOpen}
        onClose={confirmationModalProps.onClose}
        icon={confirmationModalProps.icon}
        link={confirmationModalProps.link}
      />
      <style jsx>{`
        .confirm-transaction-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          padding: 16px;
        }
      `}</style>
    </>
  )
}

export default DappQiConfirmTransactionPage
