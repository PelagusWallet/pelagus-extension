import React, { ReactElement } from "react"
import classNames from "classnames"
import { AccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import SharedIconGA from "../Shared/SharedIconGA"
import SharedLoadingSpinner from "../Shared/SharedLoadingSpinner"

interface SelectAccountListItemProps {
  account: AccountTotal
  isSelected: boolean
  children?: React.ReactNode
}

export default function SelectAccountListItem({
  account,
  isSelected = false,
  children = <></>,
}: SelectAccountListItemProps): ReactElement {
  if (!account) return <></>
  return (
    <div
      className={classNames("connected-account-item", {
        select: isSelected,
      })}
    >
      <div className="left-side">
        <SharedIconGA iconUrl={account?.avatarURL} />
        <div className="account-info">
          <div className="name">{account?.name}</div>
          <div className="details">
            {account?.accountSigner?.type === "keyring" &&
              `${account?.accountSigner?.shard} • `}
            {account?.shortenedAddress}
          </div>
        </div>
      </div>

      {!account?.balance ? (
        <SharedLoadingSpinner size="small" />
      ) : (
        <div className="balance">{account?.balance}</div>
      )}

      <div className="right-side">{children}</div>
      <style jsx>
        {`
          .connected-account-item {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin: 11px 16px;
            border-radius: 4px;
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
          .left-side:hover {
            opacity: 0.6;
          }
          .select .left-side:hover {
            opacity: 1;
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
          .balance {
            font-size: 12px;
            line-height: 18px;
            margin: 0 8px;
          }
        `}
      </style>
    </div>
  )
}
