import React, { ReactElement, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { selectAllowedPages } from "@pelagus/pelagus-background/redux-slices/selectors"
import SharedPageHeader from "../../components/Shared/SharedPageHeader"
import ConnectedWebsitesListItem from "./ConnectedWebsitesListItem"
import { useBackgroundSelector } from "../../hooks"
import QiCoinbaseAddressListEmpty from "./QiCoinbaseAddressListEmpty"
import SharedButton from "../../components/Shared/SharedButton"

export default function SettingsQiCoinbaseAddress(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "settings" })
  const allowedPages = useBackgroundSelector(selectAllowedPages)
  const dappsByOrigin = useMemo(() => {
    const seen = new Set()

    return allowedPages.filter((permission) => {
      if (seen.has(permission.origin)) return false

      seen.add(permission.origin)

      return true
    })
  }, [allowedPages])

  return (
    <div className="standard_width_padded wrapper">
      <SharedPageHeader withoutBackText backPath="/settings">
        {t(`qiCoinbaseAddressSettings.title`)}
      </SharedPageHeader>
      <section>
        <p className="simple_text">
          These addresses are generated specifically for miners, these are not
          recommended to be used with transactions. Learn more
        </p>
        {dappsByOrigin.length === 0 ? (
          <QiCoinbaseAddressListEmpty />
        ) : (
          <ul>
            {dappsByOrigin.map((permission) => (
              <li key={permission.origin}>
                <ConnectedWebsitesListItem permission={permission} />
              </li>
            ))}
          </ul>
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
