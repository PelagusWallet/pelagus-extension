import React, { ReactElement, useEffect, useRef, useState } from "react"
import { useHistory } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  confirmQiReservationRelease,
  rejectQiReservationRelease,
} from "@pelagus/pelagus-background/redux-slices/qiReservation"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"

type ThunkResult = {
  error?: { message?: string }
}

const errorMessage = (result: ThunkResult | undefined, fallback: string) =>
  result?.error?.message || fallback

const QiReservationReleasePage = (): ReactElement => {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const request = useBackgroundSelector(
    (state) => state.qiReservation.releaseRequest
  )
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation.qiReservationRelease",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const activeRequestIdRef = useRef<string | undefined>()
  const dispatchRef = useRef(dispatch)
  const isSubmittingRef = useRef(false)
  const isCancellingRef = useRef(false)
  const isSettledRef = useRef(false)

  activeRequestIdRef.current = request?.requestId
  dispatchRef.current = dispatch

  useEffect(() => {
    const rejectPendingRequestOnExit = () => {
      if (
        isSubmittingRef.current ||
        isCancellingRef.current ||
        isSettledRef.current
      )
        return

      const requestId = activeRequestIdRef.current
      if (!requestId) return

      isCancellingRef.current = true
      dispatchRef.current(rejectQiReservationRelease({ requestId }))
    }

    window.addEventListener("beforeunload", rejectPendingRequestOnExit)
    return () => {
      window.removeEventListener("beforeunload", rejectPendingRequestOnExit)
      rejectPendingRequestOnExit()
    }
  }, [])

  const closePopup = () => {
    window.close()
    history.push("/")
  }

  const keepAddresses = () => {
    if (isSubmittingRef.current || isCancellingRef.current) return
    isCancellingRef.current = true

    const requestId = request?.requestId
    if (!requestId) {
      isSettledRef.current = true
      closePopup()
      return
    }

    dispatch(rejectQiReservationRelease({ requestId })).finally(closePopup)
  }

  const retireAddresses = async () => {
    const requestId = request?.requestId
    if (!requestId || isSubmittingRef.current || isCancellingRef.current) return

    isSubmittingRef.current = true
    setIsSubmitting(true)
    setError("")

    try {
      const result = (await dispatch(
        confirmQiReservationRelease({ requestId })
      )) as ThunkResult | undefined
      if (result?.error) {
        setError(errorMessage(result, t("confirmError")))
        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }

      isSettledRef.current = true
      closePopup()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : t("confirmError"))
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <main className="release-wrapper">
      <SharedGoBackPageHeader
        title={t("headerTitle")}
        onBack={keepAddresses}
        preventNavigation
      />

      {request ? (
        <div className="content">
          <header>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1>{t("title")}</h1>
            <p className="origin">
              {t("requestedBy", { origin: request.origin })}
            </p>
          </header>

          <p className="summary">
            {request.reason === "terminal"
              ? t("terminalSummary")
              : t("timeoutSummary")}
          </p>

          <section className="warning" aria-labelledby="warning-title">
            <h2 id="warning-title">{t("irreversibleTitle")}</h2>
            <p>{t("irreversibleBody")}</p>
            <p>{t("recoveryWarning")}</p>
          </section>

          <section className="details" aria-labelledby="details-title">
            <h2 id="details-title">{t("requestDetailsTitle")}</h2>
            <dl>
              <div>
                <dt>{t("originLabel")}</dt>
                <dd>{request.origin}</dd>
              </div>
              <div>
                <dt>{t("reservationLabel")}</dt>
                <dd>{request.reservationId}</dd>
              </div>
              <div>
                <dt>{t("countLabel")}</dt>
                <dd>{request.count}</dd>
              </div>
              <div>
                <dt>{t("reasonLabel")}</dt>
                <dd>
                  {request.reason === "terminal"
                    ? t("terminalReason")
                    : t("timeoutReason")}
                </dd>
              </div>
              <div>
                <dt>{t("zoneLabel")}</dt>
                <dd>{request.zone}</dd>
              </div>
              <div>
                <dt>{t("accountLabel")}</dt>
                <dd>{request.account}</dd>
              </div>
            </dl>
          </section>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <p className="empty">{t("noPending")}</p>
      )}

      <SharedActionButtons
        title={{
          confirmTitle: request ? t("retireButton") : t("closeButton"),
          cancelTitle: t("keepButton"),
        }}
        onClick={{
          onConfirm: request ? retireAddresses : closePopup,
          onCancel: keepAddresses,
        }}
        isConfirmDisabled={isSubmitting}
        isLoading={isSubmitting}
      />

      <style jsx>{`
        .release-wrapper {
          position: relative;
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          padding: 16px 16px 88px;
          overflow-y: auto;
        }
        .content {
          display: grid;
          gap: 14px;
        }
        header,
        .summary,
        .warning p,
        .empty {
          margin: 0;
        }
        .eyebrow,
        dt {
          color: var(--secondary-text);
          font-size: 12px;
          font-weight: 500;
          line-height: 18px;
        }
        h1 {
          margin: 3px 0 2px;
          color: var(--primary-text);
          font-size: 22px;
          font-weight: 650;
          line-height: 28px;
        }
        .origin,
        .summary,
        .warning p,
        dd,
        .empty,
        .error {
          color: var(--secondary-text);
          font-size: 13px;
          line-height: 19px;
        }
        .origin {
          margin: 0;
          overflow-wrap: anywhere;
        }
        .warning,
        .details {
          padding: 13px 14px;
          border-radius: 8px;
          background: var(--secondary-bg);
        }
        .warning {
          border: 1px solid var(--gold-80);
        }
        h2 {
          margin: 0 0 8px;
          color: var(--primary-text);
          font-size: 14px;
          font-weight: 650;
          line-height: 20px;
        }
        .warning p + p {
          margin-top: 8px;
        }
        dl {
          display: grid;
          gap: 8px;
          margin: 0;
        }
        dl div {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 10px;
        }
        dt,
        dd {
          margin: 0;
        }
        dd {
          color: var(--primary-text);
          overflow-wrap: anywhere;
        }
        .error {
          margin: 0;
          color: var(--error-color);
        }
      `}</style>
    </main>
  )
}

export default QiReservationReleasePage
