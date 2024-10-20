import React, { ReactElement } from "react"
import { DisplayedQiCoinbaseAddress } from "./SettingsQiCoinbaseAddress"
import QiCoinbaseAddressOptionsMenu from "../../components/AccountItem/QiCoinbaseAddressOptionsMenu"

type SettingsQiCoinbaseAddressListItemProps = {
  qiCoinbaseAddress: DisplayedQiCoinbaseAddress
}

export default function SettingsQiCoinbaseAddressListItem({
  qiCoinbaseAddress,
}: SettingsQiCoinbaseAddressListItemProps): ReactElement {
  return (
    <div className="qi-coinbase-address-item">
      <div className="address-info">
        <div className="zoneName">
          {qiCoinbaseAddress.displayZone} ({qiCoinbaseAddress.displayIndex})
        </div>
        <div className="details">{qiCoinbaseAddress.displayAddress}</div>
      </div>
      <div className="button-container">
        <QiCoinbaseAddressOptionsMenu qiCoinbaseAddress={qiCoinbaseAddress} />
      </div>
      <style jsx>{`
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
        .button-container {
          margin-left: 16px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}
