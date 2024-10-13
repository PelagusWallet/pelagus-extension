import React from "react"
import { useTranslation } from "react-i18next"
import SharedLoadingSpinner from "../../components/Shared/SharedLoadingSpinner"

export default function SettingsQiCoinbaseGettingAddress(): React.ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "settings" })

  return (
    <div className="container">
      <SharedLoadingSpinner />
      <p>{t("qiCoinbaseAddressSettings.gettingAddress")}</p>
      <style jsx>
        {`
          .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 16px;
            height: 100%;
          }
          p {
            width: 250px;
            text-align: center;
            line-height: 24px;
            font-weight: 500;
            color: var(--green-40);
            font-size: 16px;
            margin-top: 16px;
          }
        `}
      </style>
    </div>
  )
}
