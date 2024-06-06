import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"

const RegularWarning = () => {
  const { t } = useTranslation()
  return <span>{t("accounts.accountItem.regularWarning")}</span>
}
const LoudWarning = () => {
  const { t } = useTranslation()
  return (
    <span>
      <h3>{t("accounts.accountItem.loudWarningTitle")}</h3>
      {t("accounts.accountItem.loudWarningBody")}
    </span>
  )
}
const LastAccountWarning = () => {
  const { t } = useTranslation()
  return (
    <span>
      <h3>{t("accounts.accountItem.lastAccountWarningTitle")}</h3>
      {t("accounts.accountItem.lastAccountWarningBody")}
    </span>
  )
}
type RemoveAccountWarningProps = {
  lastAddressInAccount: boolean
  lastAccountInPelagusWallet: boolean
  isReadOnlyAccount: boolean
}

export default function RemoveAccountWarning({
  lastAddressInAccount,
  lastAccountInPelagusWallet,
  isReadOnlyAccount,
}: RemoveAccountWarningProps): ReactElement {
  if (lastAccountInPelagusWallet) {
    return <LastAccountWarning />
  }

  if (lastAddressInAccount || isReadOnlyAccount) {
    return <LoudWarning />
  }

  return <RegularWarning />
}
