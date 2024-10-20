import React from "react"
import { DisplayedQiCoinbaseAddress } from "./SettingsQiCoinbaseAddress"
import QiCoinbaseAddressOptionsMenu from "../../components/AccountItem/QiCoinbaseAddressOptionsMenu"

type SettingsQiCoinbaseAddressListProps = {
  qiCoinbaseAddressListData: DisplayedQiCoinbaseAddress[]
}

export default function SettingsQiCoinbaseAddressList({
  qiCoinbaseAddressListData,
}: SettingsQiCoinbaseAddressListProps): React.ReactElement {
  return (
    <div className="container">
      <ul>
        {qiCoinbaseAddressListData.map((addressItem) => (
          <li key={addressItem.address}>
            <div className="qi-coinbase-address-item">
              <div className="address-info">
                <div className="zoneName">
                  {addressItem.displayZone} ({addressItem.displayIndex})
                </div>
                <div className="details">{addressItem.displayAddress}</div>
              </div>
              <QiCoinbaseAddressOptionsMenu qiCoinbaseAddress={addressItem} />
            </div>
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
          .qi-coinbase-address-item {
            display: flex;
            align-items: center;
            margin-top: 11px;
            width: 100%;
          }
          .address-info {
            flex-grow: 1;
          }
          .zoneName {
            font-size: 16px;
            font-weight: 600;
            line-height: 20px;
          }
          .details {
            font-size: 14px;
            font-weight: 400;
            line-height: 18px;
            letter-spacing: 0.05em;
          }
        `}
      </style>
    </div>
  )
}
