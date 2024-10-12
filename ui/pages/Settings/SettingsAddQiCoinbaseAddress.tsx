import React, { ReactElement, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  VALID_ZONES,
  VALID_ZONES_NAMES,
} from "@pelagus/pelagus-background/constants"
import { Zone } from "quais"
import SharedPageHeader from "../../components/Shared/SharedPageHeader"
import SharedSelect from "../../components/Shared/SharedSelect"
import SharedButton from "../../components/Shared/SharedButton"
import SettingsQiCoinbaseGettingAddress from "./SettingsQiCoinbaseGettingAddress"

export default function SettingsAddQiCoinbaseAddress(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "settings" })
  const [selectedZone, setSelectedZone] = useState<Zone | undefined>(undefined)
  const [gettingNewAddress, setGettingNewAddress] = useState<boolean>(false)
  const [addAddressComplete, setAddAddressComplete] = useState<boolean>(false)
  const [newAddress, setNewAddress] = useState<string | undefined>(undefined)
  const [newAddressZone, setNewAddressZone] = useState<Zone | undefined>(
    undefined
  )

  const zoneOptions = VALID_ZONES.map((zone, index) => ({
    value: zone,
    label: VALID_ZONES_NAMES[index],
  }))
  const handleZoneSelection = (zone: Zone) => {
    setSelectedZone(zone as Zone)
  }

  const handleAddAddressComplete = (zone: Zone, address: string) => {
    setNewAddress(address)
    setNewAddressZone(zone)
    setAddAddressComplete(true)
    setTimeout(function cb1() {
      setAddAddressComplete(false)
    }, 5000)
    setTimeout(function cb2() {
      setGettingNewAddress(false)
    }, 5000)
  }

  const handleConfirm = () => {
    setAddAddressComplete(false)
    if (selectedZone === undefined) {
      setSelectedZone(zoneOptions[0].value)
    }
    setGettingNewAddress(true)
    // call the request address method from wallet manager, when done display the complete status message
    // mock UI test
    setTimeout(function cb() {
      handleAddAddressComplete(zoneOptions[0].value, "test address")
    }, 5000)
  }

  return (
    <div className="standard_width_padded wrapper">
      <SharedPageHeader withoutBackText backPath="/settings">
        {t(`qiCoinbaseAddressSettings.addQiCoinbaseAddressTitle`)}
      </SharedPageHeader>
      {gettingNewAddress ? (
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
            onClick={() => handleConfirm()}
          >
            {t("qiCoinbaseAddressSettings.confirmButtonTitle")}
          </SharedButton>
        </>
      )}
      {addAddressComplete ? (
        <>
          <p>
            Add Address Complete: {newAddressZone}: {newAddress}
          </p>
        </>
      ) : (
        <></>
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
