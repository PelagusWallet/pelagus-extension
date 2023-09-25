import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"

const RegularWarning = () => {
  const { t } = useTranslation()
  return <span>{t("accounts.accountItem.clearHistoryWarning")}</span>
}

export default function ClearHistoryWarning(): ReactElement {
  return <RegularWarning />
}
