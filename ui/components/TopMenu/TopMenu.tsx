import React, { ReactElement, useState, useEffect, useCallback } from "react"
import { browser } from "@pelagus/pelagus-background"
import { PermissionRequest } from "@tallyho/provider-bridge-shared"
import { selectAllowedPagesForAllAcccounts } from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  FeatureFlags,
  isDisabled,
  isEnabled,
} from "@pelagus/pelagus-background/features"
import { denyOrRevokePermission } from "@pelagus/pelagus-background/redux-slices/dapp"
import { setSelectedNetwork } from "@pelagus/pelagus-background/redux-slices/ui"
import TopMenuProtocolSwitcher from "./TopMenuProtocolSwitcher"
import AccountsNotificationPanel from "../AccountsNotificationPanel/AccountsNotificationPanel"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import DAppConnection from "../DAppConnection/DAppConnection"
import SelectNetworkDrawer from "../Drawers/SelectNetworkDrawer"

import TopMenuProfileButtonGA from "./TopMenuProfileButtonGA"
import SharedButton from "../Shared/SharedButton"

export default function TopMenu(): ReactElement {
  const [isProtocolListOpen, setIsProtocolListOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [selectedAccountSigner, setSelectedAccountSigner] = useState("")

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
    const connectedAccountsToDApp = allowedPages.filter(
      (permission) => permission.origin === origin
    )

    if (dAppInfo) {
      setIsConnectedToDApp(true)
      setCurrentDAppInfo(dAppInfo)
      setConnectedAccountsToDApp(connectedAccountsToDApp)
    } else {
      setIsConnectedToDApp(false)
      setConnectedAccountsToDApp([])
    }
  }, [allowedPages, setCurrentDAppInfo])

  useEffect(() => {
    initPermissionAndOrigin()
  }, [initPermissionAndOrigin])

  const deny = useCallback(async () => {
    if (typeof currentDAppInfo !== "undefined") {
      const permissionsToDeny = allowedPages.filter(
        (permission) => permission.origin === currentDAppInfo.origin
      )

      await Promise.all(
        permissionsToDeny.map((permission) =>
          dispatch(denyOrRevokePermission({ ...permission, state: "deny" }))
        )
      )
    }
  }, [dispatch, currentDAppInfo, allowedPages])

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
          onDisconnectClick={deny}
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

      <SharedSlideUpMenu
        isOpen={isNotificationsOpen}
        close={() => {
          setIsNotificationsOpen(false)
        }}
      >
        <AccountsNotificationPanel
          onCurrentAddressChange={() => setIsNotificationsOpen(false)}
          setSelectedAccountSigner={setSelectedAccountSigner}
          selectedAccountSigner={selectedAccountSigner}
        />
      </SharedSlideUpMenu>
      {isEnabled(FeatureFlags.ENABLE_UPDATED_DAPP_CONNECTIONS) && (
        <DAppConnection />
      )}
      <nav>
        <TopMenuProtocolSwitcher onClick={() => setIsProtocolListOpen(true)} />
        <TopMenuProfileButtonGA
          onClick={() => {
            setIsNotificationsOpen(!isNotificationsOpen)
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
