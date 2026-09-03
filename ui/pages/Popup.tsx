import React, { ReactElement, useEffect } from "react"
import { MemoryRouter as Router, Switch } from "react-router-dom"

import { Store } from "webext-redux"
import { Provider } from "react-redux"
import { runtime } from "webextension-polyfill"
import {
  popupMonitorActivityMessage,
  popupMonitorPortName,
} from "@pelagus/pelagus-background/main"
import { useIsDappPopup, useTheme } from "../hooks"
import pageList from "../routes/routes"
import PrivateRoute from "../routes/PrivateRoute"

function useConnectPopupMonitor() {
  useEffect(() => {
    const port = runtime.connect(undefined, { name: popupMonitorPortName })
    let isDisconnected = false
    const handleDisconnect = () => {
      isDisconnected = true
    }
    port.onDisconnect.addListener(handleDisconnect)

    const markUserActivity = () => {
      if (isDisconnected) return

      try {
        port.postMessage(popupMonitorActivityMessage)
      } catch {
        isDisconnected = true
      }
    }

    document.addEventListener("pointerdown", markUserActivity)
    document.addEventListener("keydown", markUserActivity)

    return () => {
      document.removeEventListener("pointerdown", markUserActivity)
      document.removeEventListener("keydown", markUserActivity)
      port.onDisconnect.removeListener(handleDisconnect)
      if (!isDisconnected) port.disconnect()
    }
  }, [])
}

export function Main(): ReactElement {
  const isDappPopup = useIsDappPopup()

  useConnectPopupMonitor()
  useTheme()

  return (
    <>
      <Router>
        <Switch>
          {pageList.map(({ path, Component, hasTopBar }) => {
            return (
              <PrivateRoute
                Component={Component}
                path={path}
                hasTopBar={hasTopBar}
                key={path}
              />
            )
          })}
        </Switch>
      </Router>
      <>
        <style jsx global>
          {`
            ::-webkit-scrollbar {
              width: 0;
              background: transparent;
            }
          `}
        </style>
      </>
      {isDappPopup && (
        <style jsx global>
          {`
            body {
              height: 100%;
            }
          `}
        </style>
      )}
    </>
  )
}

export default function Popup({ store }: { store: Store }): ReactElement {
  return (
    <Provider store={store}>
      <Main />
    </Provider>
  )
}
