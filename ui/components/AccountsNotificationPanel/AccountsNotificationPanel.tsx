import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import SharedSlideUpMenuPanel from "../Shared/SharedSlideUpMenuPanel"
import AccountsNotificationPanelAccounts from "./AccountsNotificationPanelAccounts"

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
  const { t } = useTranslation()

  return (
    <SharedSlideUpMenuPanel
      header={t("accounts.notificationPanel.accountPanelName")}
    >
      <AccountsNotificationPanelAccounts
        onCurrentAddressChange={onCurrentAddressChange}
        setSelectedAccountSigner={setSelectedAccountSigner}
        selectedAccountSigner={selectedAccountSigner}
      />
    </SharedSlideUpMenuPanel>
  )
}
