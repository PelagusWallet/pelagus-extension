import React, { ReactElement, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { PermissionRequest } from "@pelagus-provider/provider-bridge-shared"
import { getAllAccounts } from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  AccountData,
  ListAccount,
} from "@pelagus/pelagus-background/redux-slices/accounts"
import SharedDrawer from "../Shared/SharedDrawer"
import { useBackgroundSelector } from "../../hooks"
import ConnectionDAppGuideline from "../Shared/ConnectionDAppGuideline"
import DAppAccountsList from "../DAppConnection/DAppAccountsList"
import { getExtendedZoneForAddress } from "@pelagus/pelagus-background/services/chain/utils"

interface DAppConnectionDrawerProps {
  currentDAppInfo: PermissionRequest
  isDAppConnectionOpen: boolean
  setIsDAppConnectionOpen: (value: React.SetStateAction<boolean>) => void
  isConnectedToDApp: boolean
  connectedAccountsToDApp: PermissionRequest[]
  onDisconnectAddressClick: (address: string) => Promise<void>
  onDisconnectAllAddressesClick: () => Promise<void>
}

export default function DAppConnectionDrawer({
  currentDAppInfo,
  isDAppConnectionOpen,
  setIsDAppConnectionOpen,
  isConnectedToDApp,
  connectedAccountsToDApp,
  onDisconnectAddressClick,
  onDisconnectAllAddressesClick,
}: DAppConnectionDrawerProps): ReactElement {
  const { origin: dAppUrl, faviconUrl: dAppFaviconUrl } = currentDAppInfo
  const { t } = useTranslation("translation", {
    keyPrefix: "drawers.dAppConnection",
  })
  const allAccounts = useBackgroundSelector(getAllAccounts)

  const filteredAccounts = useMemo(() => {
    return connectedAccountsToDApp.reduce(
      (acc: ListAccount[], connectedAccount) => {
        const { accountAddress, chainID } = connectedAccount
        const filteredAccount = allAccounts.find(
          (account) =>
            account !== "loading" &&
            account.address === accountAddress &&
            account.network.chainID === chainID
        ) as AccountData

        if (filteredAccount)
          acc.push({
            address: filteredAccount.address,
            defaultAvatar: filteredAccount.defaultAvatar,
            defaultName: filteredAccount.defaultName,
            shard: getExtendedZoneForAddress(filteredAccount.address),
          })

        return acc
      },
      []
    )
  }, [allAccounts, connectedAccountsToDApp])

  const numFilteredAccounts = filteredAccounts.length

  return (
    <SharedDrawer
      title={t("title")}
      isOpen={isDAppConnectionOpen}
      close={() => {
        setIsDAppConnectionOpen(false)
      }}
      footer={
        numFilteredAccounts ? (
          <button
            type="button"
            className="disconnect-btn"
            aria-label={t("disconnectButtonText")}
            onClick={onDisconnectAllAddressesClick}
          >
            {t("disconnectButtonText")}
          </button>
        ) : null
      }
    >
      <div className="dAppInfo-header-wrap">
        <div className="dAppInfo-header-text">
          {t("youHave")} {numFilteredAccounts}{" "}
          {numFilteredAccounts === 1
            ? t("oneConnectedAccount")
            : t("multipleConnectedAccounts")}{" "}
          {t("accountsConnected")}
        </div>
        {numFilteredAccounts > 0 ? (
          <div className="dAppInfo-header-info">
            <div className="info-favicon" />
            <div className="info-url">{dAppUrl}</div>
          </div>
        ) : (
          <ConnectionDAppGuideline isConnected={isConnectedToDApp} />
        )}
      </div>
      {numFilteredAccounts > 0 && (
        <DAppAccountsList
          accountsList={filteredAccounts}
          onDisconnectAddressClick={onDisconnectAddressClick}
        />
      )}

      <style jsx>{`
        .dAppInfo-header-wrap {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .dAppInfo-header-text {
          font-size: 12px;
          font-weight: 400;
          line-height: 18px;
          opacity: 60%;
        }
        .dAppInfo-header-info {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
        }
        .info-favicon {
          background: url("${dAppFaviconUrl === ""
            ? "./images/dapp_favicon_default@2x.png"
            : dAppFaviconUrl}");
          background-size: cover;
          width: 16px;
          height: 16px;
          border-radius: 12px;
          flex-shrink: 0;
        }
        .info-url {
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
        }
        .disconnect-btn {
          font-weight: 500;
          line-height: 20px;
          border: 1px solid var(--green-40);
          border-radius: 4px;
          width: 100%;
          padding: 10px;
          text-align: center;
          box-sizing: border-box;
          color: var(--green-40);
        }
        .disconnect-btn:hover {
          border-color: var(--green-20);
          color: var(--green-20);
        }
      `}</style>
    </SharedDrawer>
  )
}
