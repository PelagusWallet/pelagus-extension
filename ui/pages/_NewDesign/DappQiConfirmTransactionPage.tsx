import React, { ReactElement, useRef, useState } from "react"
import { useHistory } from "react-router-dom"
import {
  rejectDappQiTransaction,
  sendDappQiTransaction,
} from "@pelagus/pelagus-background/redux-slices/qiSend"
import { NormalizedQiSendToOutputsRequest } from "@pelagus/pelagus-background/services/transactions/types"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { useTranslation } from "react-i18next"
import { formatQi } from "quais"
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
        {request.origin && <p className="origin">{request.origin}</p>}
        <div className="outputs">
          {request.outputs.map((output) => (
            <div className="output" key={output.address}>
              <span>{short(output.address)}</span>
              <b>{t("denomination", { denomination: output.denomination })}</b>
            </div>
          ))}
        </div>
        {request.tradeHash && (
          <p className="trade">
            {t("trade", { tradeHash: short(request.tradeHash) })}
          </p>
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
        .trade {
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
          gap: 8px;
          margin: 16px 0 0;
        }
        .output {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid var(--tertiary-bg);
          color: var(--primary-text);
          font-size: 13px;
        }
        .output b {
          white-space: nowrap;
        }
        .trade {
          margin-top: 12px;
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
                dispatch(rejectDappQiTransaction())
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
