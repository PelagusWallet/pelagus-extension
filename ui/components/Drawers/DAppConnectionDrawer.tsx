import React, { ReactElement, useMemo } from "react"
import { useTranslation } from "react-i18next"
import classNames from "classnames"
import SharedDrawer from "../Shared/SharedDrawer"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import { PermissionRequest } from "@tallyho/provider-bridge-shared"
import { getAllAccounts } from "@pelagus/pelagus-background/redux-slices/selectors"

interface DAppConnectionDrawerProps {
  dAppTitle: string
  dAppUrl: string
  dAppFaviconUrl: string
  isDAppConnectionOpen: boolean
  setIsDAppConnectionOpen: (value: React.SetStateAction<boolean>) => void
  isConnectedToDApp: boolean
  connectedAccountsToDApp: PermissionRequest[]
  onDisconnectClick: () => Promise<void>
}

export default function DAppConnectionDrawer({
  dAppTitle,
  dAppUrl,
  dAppFaviconUrl,
  isDAppConnectionOpen,
  setIsDAppConnectionOpen,
  isConnectedToDApp,
  connectedAccountsToDApp,
  onDisconnectClick,
}: DAppConnectionDrawerProps): ReactElement {
  const dispatch = useBackgroundDispatch()
  const { t } = useTranslation("translation", {
    keyPrefix: "topMenu.connectedDappInfo",
  })

  const allAccounts = useBackgroundSelector(getAllAccounts)

  console.log("=== allAccounts", allAccounts)
  console.log("=== connectedAccountsToDApp", connectedAccountsToDApp)

  const filteredAccounts = useMemo(() => {
    return connectedAccountsToDApp.map((connectedAccount) => {
      const { accountAddress, chainID } = connectedAccount
      const filteredAccount = allAccounts.find(
        (account) =>
          account !== "loading" &&
          account.address === accountAddress &&
          account.network.chainID === chainID
      )

      if (filteredAccount && filteredAccount !== "loading") {
        return {
          address: filteredAccount.address,
          defaultAvatar: filteredAccount.defaultAvatar,
          defaultName: filteredAccount.defaultName,
          network: filteredAccount.network.name,
        }
      } else {
        return null
      }
    })
  }, [allAccounts, connectedAccountsToDApp])

  return (
    <>
      <SharedDrawer
        title={t(`${isConnectedToDApp ? "dAppTitle" : "dappConnections"}`)}
        isOpen={isDAppConnectionOpen}
        close={() => {
          setIsDAppConnectionOpen(false)
        }}
      >
        <div
          className={classNames("dAppInfo_wrap", {
            visible: isConnectedToDApp,
          })}
        >
          <div className="favicon" />
          <div className="title text ellipsis" title={dAppTitle}>
            {dAppTitle}
          </div>
          <div className="url text ellipsis" title={dAppUrl}>
            {dAppUrl}
          </div>
          <button
            aria-label="disconnect"
            type="button"
            className="disconnect_icon"
            onClick={onDisconnectClick}
          />
        </div>
        <div className="accounts-list">
          <h3>Connected Accounts:</h3>
          <ul>
            {filteredAccounts.map((account, index) => (
              <li key={index}>
                <div>
                  <div>Address: {account?.address}</div>
                  <div>Name: {account?.defaultName}</div>
                  <div>Avatar: {account?.defaultAvatar}</div>
                  <div>Network: {account?.network}</div>
                </div>
                <br />
              </li>
            ))}
          </ul>
        </div>
      </SharedDrawer>
      <style jsx>{`
        .bg {
          width: 100%;
          height: 100%;
          border-radius: 16px;
          background-color: rgba(0, 88, 179, 0.4);
          position: fixed;
          z-index: 99999;
          top: 55px;
          left: 0px;
        }
        .window {
          width: 352px;
          max-height: 90%;
          box-shadow: 0 10px 12px rgba(0, 20, 19, 0.34),
            0 14px 16px rgba(0, 20, 19, 0.24), 0 24px 24px rgba(0, 20, 19, 0.14);
          border-radius: 8px;
          background-color: var(--hunter-green);
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 0 auto;
          justify-content: space-between;
          padding-bottom: 16px;
        }
        .content {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .icon_close {
          mask-image: url("./images/close.svg");
          mask-size: cover;
          width: 12px;
          height: 12px;
          position: absolute;
          right: 33px;
          background-color: var(--green-20);
          z-index: 1;
          margin-top: 17px;
        }
        .void_space {
          height: 100%;
          width: 100%;
          position: fixed;
          top: 0;
          left: 0;
          z-index: -1;
        }
        h1 {
          color: var(--${isConnectedToDApp ? "success" : "green-20"});
          font-size: 16px;
          font-weight: 400;
          line-height: 24px;
          text-align: center;
        }
        .favicon {
          background: url("${dAppFaviconUrl === ""
            ? "./images/dapp_favicon_default@2x.png"
            : dAppFaviconUrl}");
          background-size: cover;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .title {
          color: #fff;
          font-weight: 500;
          margin-top: 10px;
        }
        .url {
          color: var(--green-40);
          margin-top: 5px;
        }
        .text {
          font-size: 16px;
          width: calc(100% - 16px);
          padding: 0 8px;
          text-align: center;
        }
        .disconnect_icon {
          background: url("./images/disconnect@2x.png");
          background-size: cover;
          width: 16px;
          height: 18px;
          margin: 16px 0 32px;
        }
        .dAppInfo_wrap {
          width: 100%;
          display: flex;
          flex-flow: column;
          align-items: center;
          max-height: 0;
          overflow: hidden;
          transition: max-height 250ms ease-out;
        }
        .dAppInfo_wrap.visible {
          max-height: 200px;
          transition: max-height 250ms ease-in;
        }
      `}</style>
    </>
  )
}
