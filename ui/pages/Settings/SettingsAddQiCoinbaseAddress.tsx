import React, { ReactElement, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  VALID_ZONES,
  VALID_ZONES_NAMES,
} from "@pelagus/pelagus-background/constants"
import { Zone } from "quais"
import { useHistory } from "react-router-dom"
import SharedPageHeader from "../../components/Shared/SharedPageHeader"
import SharedSelect from "../../components/Shared/SharedSelect"
import SharedButton from "../../components/Shared/SharedButton"
import SettingsQiCoinbaseGettingAddress from "./SettingsQiCoinbaseGettingAddress"
import { useBackgroundDispatch } from "../../hooks"
import { addQiCoinbaseAddress } from "@pelagus/pelagus-background/redux-slices/accounts"

export default function SettingsAddQiCoinbaseAddress(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "settings" })
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const [selectedZone, setSelectedZone] = useState<Zone>(VALID_ZONES[0])
  const [isGenerating, setIsGenerating] = useState(false)

  const zoneOptions = VALID_ZONES.map((zone, index) => ({
    value: zone,
    label: VALID_ZONES_NAMES[index],
  }))

  const handleZoneSelection = (zone: Zone) => {
    setSelectedZone(zone)
  }

  const handleConfirm = async () => {
    setIsGenerating(true)

    try {
      await dispatch(addQiCoinbaseAddress({ zone: selectedZone }))
      setIsGenerating(false)
      history.goBack()
    } catch (error) {
      console.error("Error adding Qi mining address:", error)
      setIsGenerating(false)
    }
  }

  return (
    <div className="standard_width_padded wrapper">
      <SharedPageHeader withoutBackText backPath="/settings/qiCoinbaseAddress">
        {t(`qiCoinbaseAddressSettings.addQiCoinbaseAddressTitle`)}
      </SharedPageHeader>
      {isGenerating ? (
        <SettingsQiCoinbaseGettingAddress />
      ) : (
        <>
          <section>
            <SharedSelect
              options={zoneOptions}
              onChange={(value: string) => handleZoneSelection(value as Zone)}
              defaultIndex={0}
              label="Select a Network"
              width="100%"
              align-self="center"
            />
          </section>
          <SharedButton
            type="primary"
            size="large"
            onClick={handleConfirm}
          >
            {t("qiCoinbaseAddressSettings.confirmButtonTitle")}
          </SharedButton>
        </>
      )}
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
