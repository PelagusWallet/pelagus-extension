import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import SharedPageHeader from "../../components/Shared/SharedPageHeader"
import SettingsQiCoinbaseListEmpty from "./SettingsQiCoinbaseListEmpty"
import SharedButton from "../../components/Shared/SharedButton"
import SettingsQiCoinbaseAddressList from "./SettingsQiCoinbaseAddressList"
import { selectQiCoinbaseAddresses } from "@pelagus/pelagus-background/redux-slices/selectors/accountsSelectors"
import { useBackgroundSelector } from "../../hooks"

export default function SettingsQiCoinbaseAddress(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "settings" })
  const coinbaseAddressList = useBackgroundSelector(selectQiCoinbaseAddresses)

  return (
    <div className="standard_width_padded wrapper">
      <SharedPageHeader withoutBackText backPath="/settings">
        {t(`qiCoinbaseAddressSettings.title`)}
      </SharedPageHeader>
      <section>
        <p>{t(`qiCoinbaseAddressSettings.descriptionText`)}</p>
        {coinbaseAddressList.length === 0 ? (
          <SettingsQiCoinbaseListEmpty />
        ) : (
          <SettingsQiCoinbaseAddressList
            qiCoinbaseAddressListData={coinbaseAddressList}
          />
        )}
      </section>
      <SharedButton
        linkTo="/settings/addQiCoinbaseAddress"
        type="secondary"
        size="medium"
        iconSmall="add"
        iconPosition="left"
      >
        {t("qiCoinbaseAddressSettings.addAddressButtonTitle")}
      </SharedButton>
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
