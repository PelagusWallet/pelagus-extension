/* eslint-disable no-nested-ternary */
import React, { ReactElement, useState } from "react"
import {
  EstimatedFeesPerGas,
  NetworkFeeSettings,
  setFeeType,
} from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import {
  selectDefaultNetworkFeeSettings,
  selectTransactionData,
} from "@pelagus/pelagus-background/redux-slices/selectors/transactionConstructionSelectors"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import NetworkSettingsSelect from "./NetworkSettingsSelect"

interface NetworkSettingsChooserProps {
  estimatedFeesPerGas: EstimatedFeesPerGas | undefined
  onNetworkSettingsSave: (setting: NetworkFeeSettings) => void
}

export default function NetworkSettingsChooser({
  estimatedFeesPerGas,
  onNetworkSettingsSave,
}: NetworkSettingsChooserProps): ReactElement {
  const [networkSettings, setNetworkSettings] = useState(
    useBackgroundSelector(selectDefaultNetworkFeeSettings)
  )
  const transactionDetails = useBackgroundSelector(selectTransactionData)

  const dispatch = useBackgroundDispatch()

  const saveNetworkSettings = async () => {
    await dispatch(setFeeType(networkSettings.feeType))
    onNetworkSettingsSave(networkSettings)
  }

  function networkSettingsSelectorFinder() {
    if (transactionDetails) {
      return (
        <NetworkSettingsSelect
          estimatedFeesPerGas={estimatedFeesPerGas}
          networkSettings={networkSettings}
          onNetworkSettingsChange={setNetworkSettings}
          onSave={saveNetworkSettings}
        />
      )
    }

    return <></>
  }

  return (
    <>
      <div className="wrapper">{networkSettingsSelectorFinder()}</div>
      <style jsx>
        {`
          .wrapper {
            height: 100%;
            display: flex;
            flex-flow: column;
            margin-left: 12px;
            align-items: center;
          }
        `}
      </style>
    </>
  )
}
