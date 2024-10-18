import React, { useState } from "react"
import classNames from "classnames"
import {
  setIsUtxoSelected,
  setSelectedUtxoAccount,
  setShowingAccountsModal,
} from "@pelagus/pelagus-background/redux-slices/ui"
import {
  selectCurrentNetwork,
  selectCurrentUtxoAccount,
  selectIsUtxoSelected,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { Zone } from "quais"
import { UtxoAccountData } from "@pelagus/pelagus-background/redux-slices/accounts"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../hooks"
import SharedIconGA from "../../Shared/SharedIconGA"
import AccountsSearchBar from "../../AccountItem/AccountsSearchBar"
import SigningButton from "../../AccountsNotificationPanel/SigningButton"
import QiAccountOptionMenu from "../../Shared/_newDeisgn/accountTab/qiAccount/qiAccountOptionMenu/QiAccountOptionMenu"
import SharedLoadingSpinner from "../../Shared/SharedLoadingSpinner"

const QiAccountsList = () => {
  const [searchAccountsValue, setSearchAccountsValue] = useState("")
  const dispatch = useBackgroundDispatch()
  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const utxoAccountsByPaymentCode = useBackgroundSelector(
    (state) => state.account.accountsData.utxo[currentNetwork.chainID]
  )
  const { id: selectedUtxoAccId } =
    useBackgroundSelector(selectCurrentUtxoAccount) ?? {}
  const isUtxoSelected = useBackgroundSelector(selectIsUtxoSelected)

  const utxoAccountArr = Object.values(utxoAccountsByPaymentCode ?? {})

  if (!utxoAccountArr.length) return <></>

  const balanceHandle = (utxoAccount: UtxoAccountData) => {
    if (!utxoAccount?.balances[Zone.Cyprus1]) {
      return <SharedLoadingSpinner size="small" />
    }
    let qiBalance = Number(
      utxoAccount?.balances[Zone.Cyprus1]?.assetAmount?.amount
    )
    if (qiBalance > 0) {
      qiBalance = qiBalance / 1000
    }

    return `${qiBalance.toFixed(3)} ${utxoAccount?.balances[
      Zone.Cyprus1
    ]?.assetAmount?.asset?.symbol?.toUpperCase()}`
  }

  const selectAccHandle = async (account: UtxoAccountData) => {
    await dispatch(setSelectedUtxoAccount(account))
    await dispatch(setIsUtxoSelected(true))
    await dispatch(setShowingAccountsModal(false))
  }

  return (
    <>
      <div className="actions-header">
        <div className="search-bar">
          <AccountsSearchBar
            searchAccountsValue={searchAccountsValue}
            setSearchAccountsValue={setSearchAccountsValue}
          />
        </div>
        <div className="lock-signing">
          <SigningButton
            onCurrentAddressChange={() =>
              dispatch(setShowingAccountsModal(false))
            }
          />
        </div>
      </div>

      <ul>
        {utxoAccountArr.map((utxoAccount) => {
          if (!utxoAccount) return null
          return (
            <li key={utxoAccount.id}>
              <div
                role="button"
                className={classNames("connected-account-item", {
                  select:
                    isUtxoSelected && selectedUtxoAccId === utxoAccount.id,
                })}
                onClick={() => selectAccHandle(utxoAccount)}
              >
                <div className="left-side">
                  <SharedIconGA iconUrl={utxoAccount.defaultAvatar} />
                  <div className="account-info">
                    <div className="name">{utxoAccount.defaultName}</div>
                    <div className="details">
                      {utxoAccount.paymentCode.slice(0, 10)}...
                      {utxoAccount.paymentCode.slice(-10)}
                    </div>
                  </div>
                </div>
                <div className="balance">{balanceHandle(utxoAccount)}</div>
                <QiAccountOptionMenu paymentCode={utxoAccount.paymentCode} />
              </div>
            </li>
          )
        })}
      </ul>
      <style jsx>{`
        .actions-header {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .search-bar {
          position: sticky;
          top: 0;
          left: 0;
          z-index: 2;
          padding: 0 16px;
          background: var(--hunter-green);
        }

        .lock-signing {
          display: flex;
          justify-content: center;
        }

        .ul {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          align-content: center;
        }

        li {
          width: 100%;
          box-sizing: border-box;
          cursor: pointer;
        }

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
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
        }

        .balance {
          font-size: 12px;
          line-height: 18px;
          margin: 0 8px;
        }
      `}</style>
    </>
  )
}

export default QiAccountsList
