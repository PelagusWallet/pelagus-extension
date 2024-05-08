import React, { ReactElement, useState, useEffect, useCallback } from "react"
import { browser } from "@pelagus/pelagus-background"
import { PermissionRequest } from "@tallyho/provider-bridge-shared"
import { selectAllowedPages } from "@pelagus/pelagus-background/redux-slices/selectors"
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
import TopMenuConnectedDAppInfo from "./TopMenuConnectedDAppInfo"
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

  const [currentPermission, setCurrentPermission] = useState<PermissionRequest>(
    {} as PermissionRequest
  )
  const [isConnectedToDApp, setIsConnectedToDApp] = useState(false)
  const allowedPages = useBackgroundSelector((state) =>
    selectAllowedPages(state)
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

    const allowPermission = allowedPages.find(
      (permission) => permission.origin === origin
    )

    if (allowPermission) {
      setCurrentPermission(allowPermission)
      setIsConnectedToDApp(true)
    } else {
      setIsConnectedToDApp(false)
    }
  }, [allowedPages, setCurrentPermission])

  useEffect(() => {
    initPermissionAndOrigin()
  }, [initPermissionAndOrigin])

  const deny = useCallback(async () => {
    if (typeof currentPermission !== "undefined") {
      // Deletes all permissions corresponding to the currently selected
      // account and origin
      await Promise.all(
        allowedPages.map(async (permission) => {
          if (permission.origin === currentPermission.origin) {
            return dispatch(
              denyOrRevokePermission({ ...permission, state: "deny" })
            )
          }
          return undefined
        })
      )
    }
  }, [dispatch, currentPermission, allowedPages])

  return (
    <>
      {isDisabled(FeatureFlags.ENABLE_UPDATED_DAPP_CONNECTIONS) &&
      isActiveDAppConnectionInfoOpen ? (
        <TopMenuConnectedDAppInfo
          title={currentPermission.title}
          url={currentPermission.origin}
          faviconUrl={currentPermission.faviconUrl}
          close={() => {
            setIsActiveDAppConnectionInfoOpen(false)
          }}
          disconnect={deny}
          isConnected={isConnectedToDApp}
        />
      ) : null}

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
