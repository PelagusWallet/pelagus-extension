import React, { ReactElement, useEffect } from "react"
import { MemoryRouter as Router, Switch } from "react-router-dom"

import { userActivityEncountered } from "@pelagus/pelagus-background/redux-slices/ui"

import { Store } from "webext-redux"
import { Provider } from "react-redux"
import { runtime } from "webextension-polyfill"
import { popupMonitorPortName } from "@pelagus/pelagus-background/main"
import { selectCurrentAddressNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  useIsDappPopup,
  useBackgroundDispatch,
  useBackgroundSelector,
} from "../hooks"
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
  const dispatch = useBackgroundDispatch()

  const currentAccount = useBackgroundSelector(selectCurrentAddressNetwork)
  // Emit an event when the popup page is first loaded.
  useEffect(() => {
    /**
     * Marking user activity every time this component is rerendered
     * lets us avoid edge cases where we fail to mark user activity on
     * a given account when a user has the wallet open for longer than
     * the current NETWORK_POLLING_TIMEOUT and is clicking around between
     * tabs / into assets / etc.
     */
    dispatch(userActivityEncountered(currentAccount))
  })

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
