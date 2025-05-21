import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import { useDispatch } from "react-redux"
import { useTranslation } from "react-i18next"
import { useBackgroundSelector } from "../../hooks"
import { wrapQiHandle } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import ConfirmWrap from "../../components/_NewDesign/WrapAsset/ConfirmWrap"
import SharedConfirmationModal from "../../components/Shared/SharedConfirmationModal"
import SharedButton from "../../components/Shared/SharedButton"
import { isUtxoAccountTypeGuard, isAccountTotalTypeGuard } from "../../utils/accounts"
import SharedGoBackPageHeader from "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader"

const ConfirmWrapPage = () => {
  const { t } = useTranslation("translation", { keyPrefix: "wallet" })
  const history = useHistory()
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

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
      dispatch(wrapQiHandle({ from, amount, to: to.address }))
      setIsModalOpen(true)
    } catch (error) {
      console.error("Failed to wrap Qi:", error)
    } finally {
      setIsLoading(false)
    }
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
        >
          {isLoading ? t("wrapping") : t("confirm")}
        </SharedButton>
      </div>

      <SharedConfirmationModal
        isOpen={isModalOpen}
        headerTitle={t("wrapSuccess")}
        title={`Qi wrapped successfully to ${to && isAccountTotalTypeGuard(to) ? to.address : "Quai"}`}
        onClose={() => {
          setIsModalOpen(false)
          history.push("/")
        }}
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