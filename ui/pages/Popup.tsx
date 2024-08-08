import React, { ReactElement, useState, useEffect } from "react"
import { MemoryRouter as Router, Switch, Route } from "react-router-dom"

import {
  setRouteHistoryEntries,
  userActivityEncountered,
} from "@pelagus/pelagus-background/redux-slices/ui"

import { Store } from "webext-redux"
import { Provider } from "react-redux"
import { TransitionGroup, CSSTransition } from "react-transition-group"
import { isAllowedQueryParamPage } from "@pelagus-provider/provider-bridge-shared"
import { runtime } from "webextension-polyfill"
import { FeatureFlags, isEnabled } from "@pelagus/pelagus-background/features"
import { popupMonitorPortName } from "@pelagus/pelagus-background/main"
import {
  getAddressCount,
  selectCurrentAccountSigner,
  selectCurrentAddressNetwork,
  selectKeyringStatus,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { selectIsTransactionPendingSignature } from "@pelagus/pelagus-background/redux-slices/selectors/transactionConstructionSelectors"
import { Location } from "history"
import {
  useIsDappPopup,
  useBackgroundDispatch,
  useBackgroundSelector,
} from "../hooks"

import setAnimationConditions, {
  animationStyles,
} from "../utils/pageTransition"

import pageList from "../routes/routes"
import GlobalModal from "../components/GlobalModal/GlobalModal"
import PrivateRoute from "../routes/PrivateRoute"

const pagePreferences = Object.fromEntries(
  pageList.map(({ path, hasTopBar, persistOnClose }) => [
    path,
    { hasTopBar, persistOnClose },
  ])
)

function transformLocation(
  inputLocation: Location,
  isTransactionPendingSignature: boolean,
  needsKeyringUnlock: boolean,
  hasAccounts: boolean
): Location {
  // The inputLocation is not populated with the actual query string — even though it should be
  // so I need to grab it from the window
  const params = new URLSearchParams(window.location.search)
  const maybePage = params.get("page")

  let { pathname } = inputLocation
  if (
    hasAccounts &&
    isAllowedQueryParamPage(maybePage) &&
    !inputLocation.pathname.includes("/keyring/")
  ) {
    pathname = maybePage
  }

  if (isTransactionPendingSignature) {
    pathname =
      !isEnabled(FeatureFlags.USE_UPDATED_SIGNING_UI) && needsKeyringUnlock
        ? "/keyring/unlock"
        : "/sign-transaction"
  }

  return {
    ...inputLocation,
    pathname,
  }
}

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
  const [isDirectionRight, setIsDirectionRight] = useState(true)

  const routeHistoryEntries = useBackgroundSelector(
    (state) => state.ui.routeHistoryEntries
  )

  // See comment above call of saveHistoryEntries
  function saveHistoryEntries(routeHistoryEntities: Location[]) {
    const entries = routeHistoryEntities
      .reduce((agg: Partial<Location>[], entity) => {
        const { ...entityCopy } = entity as Partial<Location>
        delete entityCopy.hash
        delete entityCopy.key
        agg.push(entityCopy)
        return agg
      }, [])
      .reverse()

    if (JSON.stringify(routeHistoryEntries) !== JSON.stringify(entries)) {
      dispatch(setRouteHistoryEntries(entries))
    }
  }

  const isTransactionPendingSignature = useBackgroundSelector(
    selectIsTransactionPendingSignature
  )
  const currentAccountSigner = useBackgroundSelector(selectCurrentAccountSigner)
  const keyringStatus = useBackgroundSelector(selectKeyringStatus)
  const hasAccounts = useBackgroundSelector(
    (state) => getAddressCount(state) > 0
  )

  const needsKeyringUnlock =
    isTransactionPendingSignature &&
    currentAccountSigner?.type === "keyring" &&
    keyringStatus !== "unlocked"

  useConnectPopupMonitor()

  return (
    <>
      <GlobalModal id="meet_pelagus" />
      <Router initialEntries={routeHistoryEntries}>
        <Route
          render={(routeProps) => {
            const transformedLocation = transformLocation(
              routeProps.location,
              isTransactionPendingSignature,
              needsKeyringUnlock,
              hasAccounts
            )

            const normalizedPathname = pagePreferences[
              transformedLocation.pathname
            ]
              ? transformedLocation.pathname
              : "/"

            // `initialEntries` needs to be a reversed version of route history
            // entities. Without avoiding the initial load, entries will keep reversing.
            // Given that restoring our route history is a "POP" `history.action`,
            // by specifying "PUSH" we know that the most recent navigation change is by
            // the user or explicitly added. That said, we can still certainly "POP" via
            // history.goBack(). This case is not yet accounted for.
            if (
              pagePreferences[normalizedPathname]?.persistOnClose === true &&
              routeProps.history.action === "PUSH"
            ) {
              // @ts-expect-error TODO: fix the typing
              saveHistoryEntries(routeProps.history.entries)
            }

            setAnimationConditions(routeProps, setIsDirectionRight)

            return (
              <TransitionGroup>
                <CSSTransition
                  timeout={300}
                  classNames="page-transition"
                  key={
                    routeProps.location.pathname.includes("onboarding") ||
                    routeProps.location.pathname.includes("keyring")
                      ? ""
                      : transformedLocation.key
                  }
                >
                  <div>
                    <Switch location={transformedLocation}>
                      {pageList.map(({ path, Component, hasTopBar }) => {
                        return (
                          <PrivateRoute
                            Component={Component}
                            location={transformedLocation}
                            path={path}
                            hasTopBar={hasTopBar}
                            key={path}
                          />
                        )
                      })}
                    </Switch>
                  </div>
                </CSSTransition>
              </TransitionGroup>
            )
          }}
        />
      </Router>
      <>
        <style jsx global>
          {`
            ::-webkit-scrollbar {
              width: 0;
              background: transparent;
            }

            ${animationStyles(isDirectionRight)}
            .hide {
              opacity: 0;
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
