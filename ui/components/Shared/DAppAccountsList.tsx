import React, { ReactElement } from "react"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { setNewSelectedAccount } from "@pelagus/pelagus-background/redux-slices/ui"
import {
  selectCurrentAccount,
  selectCurrentNetwork,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { sameEVMAddress } from "@pelagus/pelagus-background/lib/utils"
import DAppAccountListItem from "./DAppAccountListItem"

// FIXME
export type ListAccount = {
  address: string
  defaultAvatar: string
  defaultName: string
  shard: string
} | null

type DAppAccountsListProps = {
  accountsList: ListAccount[]
}

export default function DAppAccountsList({
  accountsList,
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

  // FIXME add logic/fix connection bugs
  const onAccountDAppDisconnectClick = () => {}

  return (
    <div className="dApp-accounts-list">
      <div className="dApp-accounts-list-wrapper">
        {accountsList.map((account) => (
          <DAppAccountListItem
            key={account?.address}
            account={account}
            isSelected={isAccountConnected(account)}
            onSwitchClick={onSwitchAccountClick}
            onDisconnect={onAccountDAppDisconnectClick}
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
