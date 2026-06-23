import React, { useEffect, useState, useRef } from "react"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { useHistory } from "react-router-dom"
import {
  rejectDappQiTransaction,
  sendDappQiTransaction,
  sendQiTransaction,
} from "@pelagus/pelagus-background/redux-slices/qiSend"
import { NormalizedQiSendToOutputsRequest } from "@pelagus/pelagus-background/services/transactions/types"
import { useTranslation } from "react-i18next"
import { formatQi } from "quais"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import AccountsNotificationPanel from "../../components/AccountsNotificationPanel/AccountsNotificationPanel"
import ConfirmTransaction from "../../components/_NewDesign/ConfirmTransaction/ConfirmTransaction"
import SharedActionButtons from "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"

interface AsyncThunkResult {
  txHash?: string
  error?: { message: string }
}

const short = (value: string) =>
  value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value

const formatQit = (value: string) => {
  try {
    return `${formatQi(BigInt(value))} QI`
  } catch (_) {
    return `${value} qit`
  }
}

function DappQiTransactionDetails({
  request,
}: {
  request: NormalizedQiSendToOutputsRequest
}) {
  return (
    <>
      <section className="dapp-qi">
        <p className="eyebrow">Native Qi transaction</p>
        <h1>{formatQit(request.amountQit)}</h1>
        {request.origin && <p className="origin">{request.origin}</p>}
        <div className="outputs">
          {request.outputs.map((output, index) => (
            <div className="output" key={`${output.address}-${index}`}>
              <span>{short(output.address)}</span>
              <b>denom {output.denomination}</b>
            </div>
          ))}
        </div>
        {request.tradeHash && (
          <p className="trade">Trade {short(request.tradeHash)}</p>
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

const ConfirmTransactionPage = () => {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const network = useBackgroundSelector(selectCurrentNetwork)
  const blockExplorerUrl = network.blockExplorerURL

  const { t: confirmationLocales } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation",
  })

  const { senderQuaiAccount, channelExists, dappRequest } = useBackgroundSelector(
    (state) => state.qiSend
  )
  const { balance: quaiBalance = "" } = senderQuaiAccount ?? {}

  const [isInsufficientQuai, setInsufficientQuai] = useState(false)
  const [isOpenConfirmationModal, setIsOpenConfirmationModal] = useState(false)
  const [isConfirmLoading, setIsConfirmLoading] = useState(false)
  const [isTransactionError, setIsTransactionError] = useState(false)
  const [transactionHash, setTransactionHash] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")

  // Synchronous guard to prevent duplicate submissions (refs update immediately, unlike state)
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    if (channelExists) return

    const serializedBalance = Number(quaiBalance.split(" ")[0])

    if (senderQuaiAccount && !serializedBalance) {
      setInsufficientQuai(true)
      return
    }
    setInsufficientQuai(false)
  }, [quaiBalance, senderQuaiAccount, channelExists])

  const onSendQiTransaction = async () => {
    if (!channelExists && isInsufficientQuai) return

    // Synchronous check to prevent duplicate submissions from rapid clicks
    if (isSubmittingRef.current) {
      console.log("Transaction submission already in progress, ignoring click")
      return
    }
    isSubmittingRef.current = true

    setIsConfirmLoading(true)
    setIsTransactionError(false)
    setTransactionHash("")

    try {
      const result = (await dispatch(
        dappRequest ? sendDappQiTransaction() : sendQiTransaction()
      )) as AsyncThunkResult
      console.log("result", result)
      if (result?.txHash) {
        setTransactionHash(result.txHash)
      } else {
        if (result?.error) {
          setErrorMessage(result.error.message)
        }
        setIsTransactionError(true)
      }
    } catch (error: any) {
      console.error("Transaction error:", error)
      setErrorMessage(error?.message || confirmationLocales("send.errorSubtitle"))
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
        onClose: () => history.push("/"),
      }
    : {
        headerTitle: confirmationLocales("sendQi.headerTitle"),
        title: confirmationLocales("sendQi.title"),
        link: {
          text: confirmationLocales("viewTransaction"),
          url: `${blockExplorerUrl}/tx/${transactionHash}`,
        },
        isOpen: isOpenConfirmationModal,
        onClose: () => history.push("/"),
      }

  return (
    <>
      <main className="confirm-transaction-wrapper">
        <SharedGoBackPageHeader title="Confirm Transaction" />
        {dappRequest ? (
          <DappQiTransactionDetails request={dappRequest} />
        ) : (
          <ConfirmTransaction isInsufficientQuai={isInsufficientQuai} />
        )}
        <SharedActionButtons
          title={{ confirmTitle: "Send", cancelTitle: "Back" }}
          isConfirmDisabled={
            !dappRequest &&
            !channelExists &&
            (!senderQuaiAccount || isInsufficientQuai)
          }
          onClick={{
            onConfirm: onSendQiTransaction,
            onCancel: () => {
              if (dappRequest) {
                dispatch(rejectDappQiTransaction())
                window.close()
                return
              }
              history.push("-1")
            },
          }}
          isLoading={isConfirmLoading}
        />
      </main>

      <AccountsNotificationPanel
        onCurrentAddressChange={() => dispatch(setShowingAccountsModal(false))}
        isNeedToChangeAccount={false}
      />
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

export default ConfirmTransactionPage
