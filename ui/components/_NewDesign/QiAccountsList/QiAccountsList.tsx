import React, { useState } from "react"
import classNames from "classnames"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../hooks"
import SharedIconGA from "../../Shared/SharedIconGA"
import AccountsSearchBar from "../../AccountItem/AccountsSearchBar"
import SigningButton from "../../AccountsNotificationPanel/SigningButton"

const QiAccountsList = () => {
  const [searchAccountsValue, setSearchAccountsValue] = useState("")
  const dispatch = useBackgroundDispatch()
  const qiHd = useBackgroundSelector((state) => state.keyrings.qiHDWallet)

  if (!qiHd) return <></>

  const { paymentCode } = qiHd

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
        <li>
          <div className={classNames("connected-account-item")}>
            <div className="left-side">
              <SharedIconGA iconUrl="./images/avatars/compass@2x.png" />
              <div className="account-info">
                <div className="name">Cyprus 1</div>
                <div className="details">
                  {paymentCode.slice(0, 10)}...{paymentCode.slice(-10)}
                </div>
              </div>
            </div>

            <div className="balance">0.0000 QI</div>
          </div>
        </li>
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
