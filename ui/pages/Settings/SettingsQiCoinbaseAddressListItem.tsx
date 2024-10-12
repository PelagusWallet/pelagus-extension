import React, { ReactElement } from "react"
import classNames from "classnames"
import { HexString } from "@pelagus/pelagus-background/types"
import SharedCircleButton from "../../components/Shared/SharedCircleButton"

const capitalizeFirstLetter = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1)

type QiCoinbaseAddress = {
  address: string
  shard: string
}

type SettingsQiCoinbaseAddressListItemProps = {
  qiCoinbaseAddress: QiCoinbaseAddress
  onCopyClick: (address: HexString) => void
}

export default function SettingsQiCoinbaseAddressListItem({
  qiCoinbaseAddress,
  onCopyClick,
}: SettingsQiCoinbaseAddressListItemProps): ReactElement {
  return (
    <div className={classNames("qi-coinbase-address-item")}>
      <div className="left-side">
        <div className="address-info">
          <div className="zoneName">
            {" "}
            {capitalizeFirstLetter(qiCoinbaseAddress.shard)} •{" "}
          </div>
          <div className="details">{qiCoinbaseAddress.address}</div>
        </div>
      </div>
      <div className="right-side">
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
          <></>
        </SharedCircleButton>
      </div>
      <style jsx>
        {`
          .container {
            padding: 16px 0;
            border-bottom: 1px solid var(--green-95);
            width: 100%;
            flex-direction: row;
            display: flex;
          }
          .qi-coinbase-address-item {
            display: flex;
            flex-direction: row;
            align-items: left;
            margin: 11px 16px;
            width: 100%;
          }
          .left-side {
            position: relative;
            display: flex;
            flex-grow: 1;
            flex-direction: row;
            align-items: center;
            gap: 8px;
          }
          .right-side {
            position: relative;
            display: flex;
            flex-grow: 1;
            flex-direction: row;
            align-items: flex-end;
            gap: 8px;
          }
          .select .left-side::before {
            content: "";
            position: absolute;
            left: -12px;
            top: 50%;
            transform: translateY(-50%);
            border-radius: 4px;
            width: 4px;
            height: 52px;
            background-color: var(--green-80);
          }
          .address-info {
            display: flex;
            flex-direction: column;
            align-items: start;
            justify-content: center;
          }
          .zoneName {
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
          }
          .details {
            font-size: 10px;
            font-weight: 400;
            line-height: 18px;
          }
          .account-action-btn {
            font-size: 12px;
            font-weight: 400;
            line-height: 18px;
            border: 1px solid #d4d4d4;
            border-radius: 176px;
            text-align: center;
            box-sizing: border-box;
            padding: 4px 12px;
          }
          .account-action-btn.selected {
            border: 1px solid #000000;
            box-shadow: 0px 0px 0px 2px #00000033;
          }
          .connected-account-item.disabled .item-title {
            color: var(--green-20);
          }
        `}
      </style>
    </div>
  )
}
