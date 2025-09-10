import React, { ReactElement } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useHistory } from "react-router-dom"
import SharedDrawer from "../../components/Shared/SharedDrawer"
import { useTranslation } from "react-i18next"
import { forceQiWalletFullRescan } from "@pelagus/pelagus-background/redux-slices/accounts"
import { selectQiWalletSyncInProgress } from "@pelagus/pelagus-background/redux-slices/ui"

export default function SettingsForceQiRescan(): ReactElement {
  const { t } = useTranslation()
  const history = useHistory()
  const dispatch = useDispatch()
  const qiWalletSyncInProgress = useSelector(selectQiWalletSyncInProgress)

  return (
    <section className="standard_width_padded">
      <SharedDrawer
        title={t("settings.forceQiWalletRescan")}
        isOpen
        close={() => history.push("/settings")}
        gap={0}
        customStyles={{ top: "40%", transform: "translateY(-20%)" }}
      >
        <div className="confirm_rescan">
          <p>{t("settings.forceQiWalletRescanConfirm")}</p>
          <div className="button_container">
            <button
              type="button"
              className="cancel"
              onClick={() => history.push("/settings")}
              disabled={qiWalletSyncInProgress}
            >
              {t("settings.cancel")}
            </button>
            <button
              type="button"
              className="confirm"
              onClick={async () => {
                try {
                  dispatch(forceQiWalletFullRescan())
                } catch (error) {
                  // eslint-disable-next-line no-console
                  console.error("Error during Qi wallet rescan:", error)
                } finally {
                  history.push("/settings")
                }
              }}
              disabled={qiWalletSyncInProgress}
            >
              {qiWalletSyncInProgress ? t("settings.rescanning") : t("settings.confirm")}
            </button>
          </div>
        </div>
        <style jsx>{`
          .confirm_rescan {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            height: 100%;
            width: 100%;
            gap: 24px;
          }
          p {
            color: var(--primary-text);
            font-size: 14px;
            line-height: 24px;
            margin: 0;
            text-align: left;
          }
          .button_container {
            display: flex;
            justify-content: center;
            gap: 16px;
            width: 100%;
            margin-top: auto;
          }
          button {
            padding: 8px 24px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .cancel {
            background: transparent;
            border: 1px solid var(--border-dark);
            color: var(--secondary-text);
          }
          .cancel:hover:not(:disabled) {
            background: var(--secondary-bg);
          }
          .confirm {
            background: var(--accent-color);
            border: none;
            color: var(--contrast-text);
          }
          .confirm:hover:not(:disabled) {
            filter: brightness(1.1);
          }
        `}</style>
      </SharedDrawer>
    </section>
  )
}

