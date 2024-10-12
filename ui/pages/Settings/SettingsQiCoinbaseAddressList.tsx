import React from "react"
import SettingsQiCoinbaseAddressListItem from "./SettingsQiCoinbaseAddressListItem"

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
  const handleCopyClick = () => {}
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
              onCopyClick={() => handleCopyClick()}
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
