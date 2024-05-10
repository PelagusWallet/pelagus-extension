import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import {
  selectShowingAccountsModal,
  setShowingAccountsModal,
  setShowingAddAccountModal,
} from "@pelagus/pelagus-background/redux-slices/ui"
import AccountsNotificationPanelAccounts from "./AccountsNotificationPanelAccounts"
import SharedDrawer from "../Shared/SharedDrawer"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"

type Props = {
  onCurrentAddressChange: (address: string) => void
  setSelectedAccountSigner: (address: string) => void
  selectedAccountSigner: string
}

export default function AccountsNotificationPanel({
  onCurrentAddressChange,
  setSelectedAccountSigner,
  selectedAccountSigner,
}: Props): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "topMenu" })
  const dispatch = useBackgroundDispatch()
  const isShowingAccountsModal = useBackgroundSelector(
    selectShowingAccountsModal
  )
  return (
    <>
      <SharedDrawer
        title={t("accountSelect")}
        isOpen={isShowingAccountsModal}
        close={() => dispatch(setShowingAccountsModal(false))}
        fillAvailable
        customStyles={{ padding: "24px 0" }}
        titleWithoutSidePaddings
        footer={
          <div className="footer_wrap">
            <button
              type="button"
              onClick={() => dispatch(setShowingAddAccountModal(true))}
              className="confirmation-btn"
            >
              &#43; {t("addQuaiaccount")}
            </button>
          </div>
        }
      >
        <AccountsNotificationPanelAccounts
          onCurrentAddressChange={onCurrentAddressChange}
          setSelectedAccountSigner={setSelectedAccountSigner}
          selectedAccountSigner={selectedAccountSigner}
        />
      </SharedDrawer>
      <style jsx>
        {`
          .confirmation-btn {
            font-weight: 500;
            line-height: 20px;
            border: 1px solid var(--white);
            border-radius: 4px;
            width: 100%;
            min-height: 40px;
            padding: 10px;
            text-align: center;
            box-sizing: border-box;
            color: var(--white);
            margin: 0;
          }

          .confirmation-btn:hover {
            color: var(--green-40);
          }

          .footer_wrap {
            width: 100%;
            position: fixed;
            bottom: 16px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 0 16px;
            box-sizing: border-box;
          }
        `}
      </style>
    </>
  )
}
