import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import SharedPageHeader from "../../components/Shared/SharedPageHeader"

export default function SettingsAddQiCoinbaseAddress(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "settings" })

  return (
    <div className="standard_width_padded wrapper">
      <SharedPageHeader withoutBackText backPath="/settings">
        {t(`qiCoinbaseAddressSettings.addQiCoinbaseAddressTitle`)}
      </SharedPageHeader>
      <section>
        <p className="simple_text">Select A Network</p>
      </section>
      <style jsx>{`
        .wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
      `}</style>
    </div>
  )
}
