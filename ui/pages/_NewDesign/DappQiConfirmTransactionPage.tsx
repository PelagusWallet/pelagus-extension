import React, { ReactElement, useRef, useState } from "react"
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

const short = (value: string) =>
  value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value

const formatQit = (value: string, fallbackUnit: string) => {
  try {
    return `${formatQi(BigInt(value))} QI`
  } catch (_) {
    return `${value} ${fallbackUnit}`
  }
}

const formatDenomination = (denomination: number, fallbackUnit: string) => {
  const qitValue = denominations[denomination]
  if (qitValue === undefined) return `${fallbackUnit} ${denomination}`
  return formatQit(BigInt(qitValue).toString(), fallbackUnit)
}

function DappQiTransactionDetails({
  request,
}: {
  request: NormalizedQiSendToOutputsRequest
}) {
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation.dappQi",
  })

  return (
    <>
      <section className="dapp-qi">
        <p className="eyebrow">{t("title")}</p>
        <h1>{formatQit(request.amountQit, t("qitUnit"))}</h1>
        {request.origin && (
          <p className="origin">
            {t("requestedBy", { origin: request.origin })}
          </p>
        )}
        <div className="outputs">
          {request.outputs.map((output) => (
            <div className="output" key={output.address}>
              <div className="output-address">
                <span>{t("toLabel")}</span>
                <b title={output.address}>{short(output.address)}</b>
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
        {(request.label || request.tradeHash) && (
          <div className="details">
            {request.label && (
              <div className="detail">
                <span>{t("actionLabel")}</span>
                <b title={request.label}>{request.label}</b>
              </div>
            )}
            {request.tradeHash && (
              <div className="detail">
                <span>{t("referenceLabel")}</span>
                <b title={request.tradeHash}>{short(request.tradeHash)}</b>
              </div>
            )}
          </div>
        )}
      </section>
      <style jsx>{`
        .dapp-qi {
          padding: 20px 16px;
          margin: 8px 0 14px;
          border-radius: 8px;
          background: var(--secondary-bg);
        }
        .eyebrow,
        .origin,
        .details {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 14px;
        }
        .detail {
          margin: 0;
          color: var(--secondary-text);
          font-size: 12px;
          line-height: 18px;
          font-weight: 500;
        }
        h1 {
          margin: 4px 0 8px;
          color: var(--primary-text);
          font-size: 28px;
          line-height: 34px;
          font-weight: 600;
        }
        .outputs {
          display: flex;
          flex-direction: column;
          gap: 0;
          margin: 16px 0 0;
          border-top: 1px solid var(--tertiary-bg);
        }
        .output {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid var(--tertiary-bg);
          color: var(--primary-text);
          font-size: 13px;
        }
        .output-address,
        .output-amount,
        .detail {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .output-address span,
        .output-amount span,
        .detail span {
          color: var(--secondary-text);
          font-size: 12px;
          line-height: 16px;
          font-weight: 500;
        }
        .output-address b,
        .output-amount b,
        .detail b {
          color: var(--primary-text);
          font-size: 14px;
          line-height: 20px;
          font-weight: 600;
        }
        .output-address b,
        .detail b {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .output-amount {
          align-items: flex-end;
          text-align: right;
          white-space: nowrap;
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
  const isSubmittingRef = useRef(false)

  const closeDappPopup = () => {
    window.close()
    history.push("/")
  }

  const onSendQiTransaction = async () => {
    if (!dappRequest || isSubmittingRef.current) return
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

  return (
    <>
      <main className="confirm-transaction-wrapper">
        <SharedGoBackPageHeader title="Confirm Transaction" />
        {dappRequest ? (
          <DappQiTransactionDetails request={dappRequest} />
        ) : (
          <NoPendingDappRequest />
        )}
        <SharedActionButtons
          title={{
            confirmTitle: dappRequest ? "Send" : "Close",
            cancelTitle: "Back",
          }}
          isConfirmDisabled={false}
          onClick={{
            onConfirm: dappRequest ? onSendQiTransaction : closeDappPopup,
            onCancel: () => {
              if (dappRequest) {
                dispatch(rejectDappQiTransaction()).finally(closeDappPopup)
                return
              }
              closeDappPopup()
            },
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
