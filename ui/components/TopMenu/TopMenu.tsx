import React, { ReactElement, useState, useEffect, useCallback } from "react"
import { browser } from "@pelagus/pelagus-background"
import { PermissionRequest } from "@pelagus-provider/provider-bridge-shared"
import {
  selectAllowedPagesForAllAcccounts,
  selectCurrentNetwork,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  FeatureFlags,
  isDisabled,
  isEnabled,
} from "@pelagus/pelagus-background/features"
import {
  denyDAppPermissions,
  denyDAppPermissionForAddress,
} from "@pelagus/pelagus-background/redux-slices/dapp"
import {
  setSelectedNetwork,
  setShowingAccountsModal,
} from "@pelagus/pelagus-background/redux-slices/ui"
import TopMenuProtocolSwitcher from "./TopMenuProtocolSwitcher"
import AccountsNotificationPanel from "../AccountsNotificationPanel/AccountsNotificationPanel"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import DAppConnection from "../DAppConnection/DAppConnection"
import SelectNetworkDrawer from "../Drawers/SelectNetworkDrawer"
import DAppConnectionDrawer from "../Drawers/DAppConnectionDrawer"
import TopMenuProfileButtonGA from "./TopMenuProfileButtonGA"
import SharedButton from "../Shared/SharedButton"

export default function TopMenu(): ReactElement {
  const [isProtocolListOpen, setIsProtocolListOpen] = useState(false)

  const [isActiveDAppConnectionInfoOpen, setIsActiveDAppConnectionInfoOpen] =
    useState(false)

  const dispatch = useBackgroundDispatch()

  const [currentDAppInfo, setCurrentDAppInfo] = useState<PermissionRequest>(
    {} as PermissionRequest
  )
  const [connectedAccountsToDApp, setConnectedAccountsToDApp] = useState<
    PermissionRequest[]
  >([])
  const [isConnectedToDApp, setIsConnectedToDApp] = useState(false)
  const allowedPages = useBackgroundSelector((state) =>
    selectAllowedPagesForAllAcccounts(state)
  )
  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)

  const onProtocolListClose = () => setIsProtocolListOpen(false)

  const initPermissionAndOrigin = useCallback(async () => {
    const { url } = await browser.tabs
      .query({
        active: true,
        lastFocusedWindow: true,
      })
      .then((tabs) =>
        tabs[0] ? tabs[0] : { url: "", favIconUrl: "", title: "" }
      )
    if (!url) return

    const { origin } = new URL(url)

    const dAppInfo = allowedPages.find(
      (permission) => permission.origin === origin
    )
    const dAppAccounts = allowedPages.filter(
      (permission) =>
        permission.origin === origin &&
        permission.chainID === currentNetwork.chainID
    )

    if (dAppInfo) {
      setIsConnectedToDApp(true)
      setCurrentDAppInfo(dAppInfo)
      setConnectedAccountsToDApp(dAppAccounts)
    } else {
      setIsConnectedToDApp(false)
      setConnectedAccountsToDApp([])
    }
  }, [allowedPages, currentNetwork, setCurrentDAppInfo])

  useEffect(() => {
    initPermissionAndOrigin()
  }, [initPermissionAndOrigin])

  const disconnectAllAddressesFromDApp = useCallback(async () => {
    if (typeof currentDAppInfo === "undefined") return

    const permissionsToDeny: PermissionRequest[] = allowedPages
      .filter((permission) => permission.origin === currentDAppInfo.origin)
      .map((permission) => ({
        ...permission,
        state: "deny" as "deny",
      }))

    await Promise.all(
      permissionsToDeny.map(() =>
        dispatch(denyDAppPermissions(permissionsToDeny))
      )
    )
  }, [dispatch, currentDAppInfo, allowedPages])

  const disconnectAddressFromDApp = useCallback(
    async (address: string) => {
      if (typeof currentDAppInfo === "undefined") return

      const permissionToDeny = allowedPages.find(
        (permission) => permission.accountAddress === address
      )
      if (!permissionToDeny) return

      await dispatch(
        denyDAppPermissionForAddress({
          permission: { ...permissionToDeny, state: "deny" },
          accountAddress: address,
        })
      )
    },
    [dispatch, currentDAppInfo, allowedPages]
  )

  return (
    <>
      {isDisabled(FeatureFlags.ENABLE_UPDATED_DAPP_CONNECTIONS) && (
        <DAppConnectionDrawer
          currentDAppInfo={currentDAppInfo}
          isConnectedToDApp={isConnectedToDApp}
          connectedAccountsToDApp={connectedAccountsToDApp}
          isDAppConnectionOpen={isActiveDAppConnectionInfoOpen}
          setIsDAppConnectionOpen={() => {
            setIsActiveDAppConnectionInfoOpen(false)
          }}
          onDisconnectAddressClick={disconnectAddressFromDApp}
          onDisconnectAllAddressesClick={disconnectAllAddressesFromDApp}
        />
      )}

      <SelectNetworkDrawer
        isProtocolListOpen={isProtocolListOpen}
        onProtocolListClose={onProtocolListClose}
        onProtocolListItemSelect={(network) => {
          dispatch(setSelectedNetwork(network))
          setIsProtocolListOpen(false)
        }}
      />

      <AccountsNotificationPanel
        onCurrentAddressChange={() => dispatch(setShowingAccountsModal(false))}
      />
      {isEnabled(FeatureFlags.ENABLE_UPDATED_DAPP_CONNECTIONS) && (
        <DAppConnection />
      )}
      <nav>
        <TopMenuProtocolSwitcher onClick={() => setIsProtocolListOpen(true)} />
        <TopMenuProfileButtonGA
          onClick={() => {
            dispatch(setShowingAccountsModal(true))
          }}
        />
        <div className="dappAndSettingsWrapper">
          {isDisabled(FeatureFlags.ENABLE_UPDATED_DAPP_CONNECTIONS) && (
            <SharedButton
              type="unstyled"
              size="small"
              onClick={() => {
                setIsActiveDAppConnectionInfoOpen(
                  !isActiveDAppConnectionInfoOpen
                )
              }}
              style={{
                padding: 0,
                background: "var(--green-95)",
                borderRadius: "50%",
              }}
            >
              {isConnectedToDApp ? (
                <img
                  src="./images/dappConnected.svg"
                  alt="dapp connected icon"
                />
              ) : (
                <img
                  src="./images/dappNotConnected.svg"
                  alt="dapp not connected icon"
                />
              )}
            </SharedButton>
          )}
          <SharedButton
            type="unstyled"
            size="small"
            linkTo="/settings"
            style={{
              padding: 0,
              background: "var(--green-95)",
              borderRadius: "50%",
            }}
          >
            <img src="./images/topMenuSettings.svg" alt="settings" />
          </SharedButton>
        </div>
      </nav>

      <style jsx>
        {`
          nav {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            gap: 30px;
          }

          .dappAndSettingsWrapper {
            display: flex;
            align-items: center;
            gap: 8px;
          }
        `}
      </style>
    </>
  )
}
