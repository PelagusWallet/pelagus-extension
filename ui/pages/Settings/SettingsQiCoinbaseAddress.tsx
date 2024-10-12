import React, { ReactElement, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SharedPageHeader from "../../components/Shared/SharedPageHeader"
import SettingsQiCoinbaseListEmpty from "./SettingsQiCoinbaseListEmpty"
import SharedButton from "../../components/Shared/SharedButton"
import SettingsQiCoinbaseAddressList from "./SettingsQiCoinbaseAddressList"

type QiCoinbaseAddress = {
  address: string
  shard: string
}

export default function SettingsQiCoinbaseAddress(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "settings" })
  const [coinbaseAddressList, setCoinbaseAddressList] = useState<
    QiCoinbaseAddress[]
  >([])

  const generateMockAddresses = () => {
    const addr1: QiCoinbaseAddress = {
      address: "0x000800dCfb49F82e367933D0461bBd537397Db71",
      shard: "Cyprus 1(1)",
    }
    const addr2: QiCoinbaseAddress = {
      address: "0x000800dCfb49F82e367933D0461bBd537397Db72",
      shard: "Cyprus 1(2)",
    }
    const addr3: QiCoinbaseAddress = {
      address: "0x000800dCfb49F82e367933D0461bBd537397Db72",
      shard: "Cyprus 1(3)",
    }
    const mockAddresses: QiCoinbaseAddress[] = []
    mockAddresses.push(addr1, addr2, addr3)
    setCoinbaseAddressList(mockAddresses)
  }

  useEffect(() => {
    generateMockAddresses()
  }, [])

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
