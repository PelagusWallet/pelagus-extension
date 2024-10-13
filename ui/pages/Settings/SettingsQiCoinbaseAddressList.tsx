import React from "react"
import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import SettingsQiCoinbaseAddressListItem from "./SettingsQiCoinbaseAddressListItem"
import { useBackgroundDispatch } from "../../hooks"
import { DisplayedQiCoinbaseAddress } from "./SettingsQiCoinbaseAddress"

type SettingsQiCoinbaseAddressListProps = {
  qiCoinbaseAddressListData: DisplayedQiCoinbaseAddress[]
}

export default function SettingsQiCoinbaseAddressList({
  qiCoinbaseAddressListData,
}: SettingsQiCoinbaseAddressListProps): React.ReactElement {
  const dispatch = useBackgroundDispatch()
  function copyAddress(address: string) {
    navigator.clipboard.writeText(address)
    dispatch(setSnackbarConfig({ message: "Address copied to clipboard" }))
  }
  return (
    <div className="container">
      <ul>
        {qiCoinbaseAddressListData.map((addressItem) => (
          <li key={addressItem.address}>
            <SettingsQiCoinbaseAddressListItem
              qiCoinbaseAddress={addressItem}
              onCopyClick={(address: string) => copyAddress(address)}
            />
          </li>
        ))}
      </ul>
      <style jsx>
        {`
          .container {
            display: flex;
            width: 100%;
            flex-direction: column;
            align-items: normal;
            margin-top: 16px;
            height: 100%;
          }
        `}
      </style>
    </div>
  )
}
