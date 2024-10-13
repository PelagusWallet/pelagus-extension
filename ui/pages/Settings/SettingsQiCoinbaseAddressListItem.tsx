import React, { ReactElement } from "react"
import { HexString } from "@pelagus/pelagus-background/types"
import SharedCircleButton from "../../components/Shared/SharedCircleButton"
import { DisplayedQiCoinbaseAddress } from "./SettingsQiCoinbaseAddress"

type SettingsQiCoinbaseAddressListItemProps = {
  qiCoinbaseAddress: DisplayedQiCoinbaseAddress
  onCopyClick: (address: HexString) => void
}

export default function SettingsQiCoinbaseAddressListItem({
  qiCoinbaseAddress,
  onCopyClick,
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
      <SharedCircleButton
        disabled={false}
        icon="icons/s/copy.svg" 
        ariaLabel="copy"
        onClick={() => {
          onCopyClick(qiCoinbaseAddress.address)
        }}
        iconColor={{
          color: "#3A4565",
          hoverColor: "#3A4565",
        }}
        iconWidth="20"
        iconHeight="18"
        size={36}
      >
        <> </>
        </SharedCircleButton>
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
