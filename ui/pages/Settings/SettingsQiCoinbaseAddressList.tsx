import React from "react"
import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import SettingsQiCoinbaseAddressListItem from "./SettingsQiCoinbaseAddressListItem"
import { useBackgroundDispatch } from "../../hooks"

type QiCoinbaseAddress = {
  address: string
  shard: string
}
type SettingsQiCoinbaseAddressListProps = {
  qiCoinbaseAddressListData: QiCoinbaseAddress[]
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
              qiCoinbaseAddress={{
                address: addressItem.address,
                shard: addressItem.shard,
              }}
              onCopyClick={(address: string) => copyAddress(address)}
            />
          </li>
        ))}
      </ul>
      <style jsx>
        {`
          .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 16px;
            height: 100%;
          }
          .bowl_image {
            width: 90px;
            margin-bottom: 10px;
          }
          p {
            width: 250px;
            text-align: center;
            line-height: 24px;
            font-weight: 500;
            color: var(--green-40);
            font-size: 16px;
          }
        `}
      </style>
    </div>
  )
}
