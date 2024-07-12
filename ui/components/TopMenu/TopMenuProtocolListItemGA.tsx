import React, { ReactElement } from "react"
import classNames from "classnames"
import SharedNetworkIcon from "../Shared/SharedNetworkIcon"
import { NetworkInterfaceGA } from "@pelagus/pelagus-background/constants/networks/networkTypes"

type TopMenuProtocolListItemGAProps = {
  network: NetworkInterfaceGA
  isSelected: boolean
  isDisabled?: boolean
  onSelect: (network: NetworkInterfaceGA) => void
}

export default function TopMenuProtocolListItemGA({
  isSelected = false,
  network,
  onSelect,
  isDisabled = false,
}: TopMenuProtocolListItemGAProps): ReactElement {
  return (
    <div
      className={classNames("networks-list-item", {
        select: isSelected,
        disabled: isDisabled,
      })}
      onClick={() => {
        if (isDisabled) return
        onSelect(network)
      }}
    >
      <div className="list-item-left">
        <div className="item-icon-wrap">
          <SharedNetworkIcon size={40} network={network} />
        </div>
      </div>
      <div className="list-item-right">
        <div className="item-title">{network.baseAsset.name}</div>
      </div>
      <style jsx>
        {`
          .networks-list-item {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            cursor: pointer;
            padding: 10px 8px;
            margin: 0 16px;
          }

          .networks-list-item.select {
            background: var(--green-95);
            margin: 0;
            padding-left: 24px;
            padding-right: 24px;
          }

          .list-item-left {
            position: relative;
          }
          .list-item-right {
            flex-grow: 1;
          }

          .item-icon-wrap {
            width: 40px;
            height: 40px;
            border-radius: 100%;
            overflow: hidden;
            background-color: var(--hunter-green);
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .select .item-icon-wrap::before {
            content: "";
            position: absolute;
            left: -20px;
            top: 50%;
            transform: translateY(-50%);
            border-radius: 4px;
            width: 4px;
            height: 52px;
            background-color: var(--green-80);
          }

          .item-title {
            color: var(--white);
            font-size: 16px;
            font-weight: 500;
            line-height: 24px;
          }

          .disabled {
            cursor: default;
          }
          .disabled .item-title {
            color: var(--green-95);
          }
        `}
      </style>
    </div>
  )
}
