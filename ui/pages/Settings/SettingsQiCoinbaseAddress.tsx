import React, { ReactElement, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SharedPageHeader from "../../components/Shared/SharedPageHeader"
import SettingsQiCoinbaseListEmpty from "./SettingsQiCoinbaseListEmpty"
import SharedButton from "../../components/Shared/SharedButton"
import SettingsQiCoinbaseAddressList from "./SettingsQiCoinbaseAddressList"
import { selectQiCoinbaseAddresses } from "@pelagus/pelagus-background/redux-slices/selectors/accountsSelectors"
import { useBackgroundSelector } from "../../hooks"
import { QiCoinbaseAddress } from "@pelagus/pelagus-background/accounts"
import { getExtendedZoneForAddress } from "@pelagus/pelagus-background/services/chain/utils"

export type DisplayedQiCoinbaseAddress = QiCoinbaseAddress & {
  displayZone: string
  displayIndex: number
  displayAddress: string
}

const capitalizeFirstLetter = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1)

export default function SettingsQiCoinbaseAddress(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "settings" })
  const [sortedCoinbaseAddressList, setSortedCoinbaseAddressList] = useState<
    DisplayedQiCoinbaseAddress[]
  >([])

  const coinbaseAddressList = useBackgroundSelector(selectQiCoinbaseAddresses)

  useEffect(() => {
    if (coinbaseAddressList.length > 0) {
      setSortedCoinbaseAddressList(formatAddressesForDisplay(coinbaseAddressList))
    }
  }, [coinbaseAddressList])

  // sort addresses by zone and index
  const sortAddressesByZoneAndIndex = (addresses: QiCoinbaseAddress[]) => {
    return addresses.sort((a, b) => {
      if (a.zone !== b.zone) {
        return a.zone.localeCompare(b.zone);
      }
      // If zones are the same, compare indices
      return a.index - b.index;
    });
  }

  const formatAddressesForDisplay = (addresses: QiCoinbaseAddress[]): DisplayedQiCoinbaseAddress[] => {
    const sortedAddresses = sortAddressesByZoneAndIndex(addresses)
    let displayZoneIndex = 0
    let currentZone = sortedAddresses[0].zone
    return sortedAddresses.map((address) => {
      if (address.zone === currentZone) {
        displayZoneIndex++
        currentZone = address.zone
      } else {
        displayZoneIndex = 1
        currentZone = address.zone
      }
      return {
        ...address,
        displayZone: capitalizeFirstLetter(
          getExtendedZoneForAddress(address.address)
        ),
        displayIndex: displayZoneIndex,
        displayAddress: address.address.slice(0, 14) + "..." + address.address.slice(-12),
      }
    })
  }

  return (
    <div className="standard_width_padded wrapper">
      <SharedPageHeader withoutBackText backPath="/settings">
        {t(`qiCoinbaseAddressSettings.title`)}
      </SharedPageHeader>
      <section>
        <p>{t(`qiCoinbaseAddressSettings.descriptionText`)}</p>
        {sortedCoinbaseAddressList.length === 0 ? (
          <SettingsQiCoinbaseListEmpty />
        ) : (
          <SettingsQiCoinbaseAddressList
            qiCoinbaseAddressListData={sortedCoinbaseAddressList}
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
