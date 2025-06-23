import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useBackgroundSelector } from "../../hooks"
import { wrapQiHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import ConfirmWrap from "../../components/_NewDesign/WrapAsset/ConfirmWrap"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"
import SharedButton from "../../components/Shared/SharedButton"
import { isUtxoAccountTypeGuard, isAccountTotalTypeGuard } from "../../utils/accounts"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"
import { useBackgroundDispatch } from "../../hooks"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"

interface AsyncThunkResult {
  txHash?: string
  error?: { message: string }
}

const ConfirmWrapPage = () => {
  const { t } = useTranslation("translation", { keyPrefix: "wallet" })

  const { t: confirmationLocales } = useTranslation("translation", {
    keyPrefix: "drawers.transactionConfirmation",
  })
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isTransactionError, setIsTransactionError] = useState(false)
  const [transactionHash, setTransactionHash] = useState("")
  const network = useBackgroundSelector(selectCurrentNetwork)
  const blockExplorerUrl = network.blockExplorerURL

  const { from, amount, to } = useBackgroundSelector((state) => state.convertAssets)

  const handleConfirm = async () => {
    if (!from || !amount || !to) {
      return
    }

    if (!isUtxoAccountTypeGuard(from) || !isAccountTotalTypeGuard(to)) {
      return
    }

    try {
      setIsLoading(true)
      const result = await dispatch(wrapQiHandle()) as AsyncThunkResult
      console.log("result", result)
      if (result?.txHash) {
        setTransactionHash(result.txHash)
      } else {
        if (result?.error) {
          setErrorMessage(result.error.message)
        }
        setIsTransactionError(true)
      }
      setIsModalOpen(true)
    } catch (error: any) {
      console.error("Failed to wrap Qi:", error)
      setErrorMessage(error?.message || "Failed to wrap Qi")
      setIsTransactionError(true)
    } finally {
      setIsLoading(false)
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
        isOpen: isModalOpen,
        onClose: () => history.push("/"),
      }
    : {
        headerTitle: t("wrapSuccess"),
        title: `Qi wrapped successfully`,
        subtitle: "Please wait a minute to claim your wrapped Qi",
        isOpen: isModalOpen,
        onClose: () => history.push("/wrap", { sentWrap: true }),
      }

  return (
    <main>
      <div className="header-area">
        <SharedGoBackPageHeader title={t("confirmWrap")} linkTo="/wrap" />
      </div>

      <div className="content">
        <ConfirmWrap />
      </div>

      <div className="footer">
        <SharedButton
          type="primary"
          size="large"
          onClick={handleConfirm}
          isDisabled={isLoading}
          isLoading={isLoading}
        >
          {t("confirm")}
        </SharedButton>
      </div>

      <SharedConfirmationModal
        headerTitle={confirmationModalProps.headerTitle}
        title={confirmationModalProps.title}
        subtitle={confirmationModalProps.subtitle}
        isOpen={confirmationModalProps.isOpen}
        onClose={confirmationModalProps.onClose}
        icon={confirmationModalProps.icon}
      />

      <style jsx>{`
        main {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .header-area {
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--primary-bg);
          padding: 16px 16px 0;
        }

        .content {
          flex: 1;
          overflow-y: auto;
          padding: 0 24px;
        }

        .footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--primary-bg);
          padding: 16px;
          z-index: 10;
          display: flex;
          justify-content: center;
        }
      `}</style>
    </main>
  )
}

export default ConfirmWrapPage 