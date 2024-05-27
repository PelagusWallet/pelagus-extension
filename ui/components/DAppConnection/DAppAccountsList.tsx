import React, { ReactElement } from "react"
import { setNewSelectedAccount } from "@pelagus/pelagus-background/redux-slices/ui"
import {
  selectCurrentAccount,
  selectCurrentNetwork,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { sameEVMAddress } from "@pelagus/pelagus-background/lib/utils"
import { ListAccount } from "@pelagus/pelagus-background/redux-slices/accounts"
import DAppAccountListItem from "./DAppAccountListItem"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"

type DAppAccountsListProps = {
  accountsList: ListAccount[]
  onDisconnectAddressClick: (address: string) => Promise<void>
}

export default function DAppAccountsList({
  accountsList,
  onDisconnectAddressClick,
}: DAppAccountsListProps): ReactElement {
  const dispatch = useBackgroundDispatch()
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)
  const currentSelectedAccount = useBackgroundSelector(selectCurrentAccount)

  const isAccountConnected = (account: ListAccount): boolean => {
    return account &&
      sameEVMAddress(account.address, currentSelectedAccount.address)
      ? true
      : false
  }

  const onSwitchAccountClick = (address: string) => {
    dispatch(
      setNewSelectedAccount({
        address,
        network: selectedNetwork,
      })
    )
  }

  return (
    <div className="dApp-accounts-list">
      <div className="dApp-accounts-list-wrapper">
        {accountsList.map((account) => (
          <DAppAccountListItem
            key={account.address}
            account={account}
            isSelected={isAccountConnected(account)}
            onSwitchClick={onSwitchAccountClick}
            onDisconnect={onDisconnectAddressClick}
          />
        ))}
      </div>
      <style jsx>
        {`
          .dApp-accounts-list {
            display: flex;
            flex-direction: column;
            min-height: auto;
            overflow-y: auto;
            overflow-x: hidden;
            margin: 0 -16px;
          }
          .dApp-accounts-list-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
        `}
      </style>
    </div>
  )
}
