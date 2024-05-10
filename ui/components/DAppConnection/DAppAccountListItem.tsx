import React, { ReactElement } from "react"
import classNames from "classnames"
import SharedIconGA from "../Shared/SharedIconGA"
import { truncateAddress } from "@pelagus/pelagus-background/lib/utils"
import { useTranslation } from "react-i18next"
import { HexString } from "@pelagus/pelagus-background/types"
import { ListAccount } from "./DAppAccountsList"

const capitalizeFirstLetter = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1)

type DAppAccountListItemProps = {
  account: ListAccount
  isSelected: boolean
  isDisabled?: boolean
  onSwitchClick: (address: HexString) => void
  onDisconnect: (address: HexString) => void
}

export default function DAppAccountListItem({
  account,
  isSelected = false,
  isDisabled = false,
  onSwitchClick,
  onDisconnect,
}: DAppAccountListItemProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.dAppConnection",
  })

  return (
    <div
      className={classNames("connected-account-item", {
        select: isSelected,
        disabled: isDisabled,
      })}
    >
      <div className="left-side">
        <SharedIconGA iconUrl={account?.defaultAvatar} />
        <div className="account-info">
          <div className="name">{account?.defaultName}</div>
          <div className="details">
            {account && capitalizeFirstLetter(account?.shard)} •{" "}
            {account && truncateAddress(account.address)}
          </div>
        </div>
      </div>

      <div className="right-side">
        <button
          type="button"
          disabled={isSelected}
          className={classNames("account-action-btn", {
            selected: isSelected,
          })}
          onClick={() => {
            isSelected
              ? account && onDisconnect(account.address)
              : account && onSwitchClick(account.address)
          }}
        >
          {isSelected
            ? // FIXME due to problems with connection logic currently Connected
              // then need to change to Disconnected (disconnectAccountBtnText)
              `${t("connectedAccountBtnText")}`
            : `${t("switchAccountBtnText")}`}
        </button>
      </div>
      <style jsx>
        {`        
          .connected-account-item {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin: 11px 16px;
          }
          .connected-account-item.select {
            background: var(--green-95);
            margin: 0;
            padding: 11px 16px;
          }

          .left-side {
            position: relative;
            display: flex;
            flex-grow: 1;
            flex-direction: row;
            align-items: center;
            gap: 8px;
          }
          .select .left-side::before {
            content: '';
            position: absolute;
            left: -12px;
            top: 50%;
            transform: translateY(-50%);
            border-radius: 4px;
            width: 4px;
            height: 52px;
            background-color: var(--green-80);
          }
          .account-info {
            display: flex;
            flex-direction: column;
            align-items: start;
            justify-content: center;
          }
          .name {
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

          .connected-account-item.disabled {
            cursor: default;
          }
          .connected-account-item.disabled .item-title {
            color var(--green-20);
          }
        `}
      </style>
    </div>
  )
}
