import React, { ReactElement, useEffect } from "react"
import { MemoryRouter as Router, Switch } from "react-router-dom"

import { Store } from "webext-redux"
import { Provider } from "react-redux"
import { runtime } from "webextension-polyfill"
import { popupMonitorPortName } from "@pelagus/pelagus-background/main"
import { useIsDappPopup } from "../hooks"
import pageList from "../routes/routes"
import GlobalModal from "../components/GlobalModal/GlobalModal"
import PrivateRoute from "../routes/PrivateRoute"

function useConnectPopupMonitor() {
  useEffect(() => {
    const port = runtime.connect(undefined, { name: popupMonitorPortName })

    return () => {
      port.disconnect()
    }
  }, [])
}

export function Main(): ReactElement {
  const isDappPopup = useIsDappPopup()

  useConnectPopupMonitor()

  return (
    <>
      <GlobalModal id="meet_pelagus" />
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
