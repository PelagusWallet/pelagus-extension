import React, { ReactElement } from "react"
import { Route, Redirect, useLocation } from "react-router-dom"
import { ErrorBoundary } from "react-error-boundary"
import { CSSTransition, TransitionGroup } from "react-transition-group"
import { isAllowedQueryParamPage } from "@pelagus-provider/provider-bridge-shared"
import { useAreKeyringsUnlocked } from "../hooks"
import CorePage from "../components/Core/CorePage"
import ErrorFallback from "../pages/ErrorFallback"

const PrivateRoute = ({
  Component,
  path,
  hasTopBar,
}: {
  Component: (...args: any[]) => ReactElement
  path: string
  hasTopBar: boolean
}): ReactElement => {
  const locationRouter = useLocation()
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const location = useLocation()

  const params = new URLSearchParams(window.location.search)
  const pathFromQuery = params.get("page") ?? ""

  return (
    <Route path={path} key={path}>
      <TransitionGroup>
        <CSSTransition timeout={300}>
          <CorePage hasTopBar={hasTopBar}>
            <ErrorBoundary FallbackComponent={ErrorFallback}>
              <Component location={location} />

              {!areKeyringsUnlocked && (
                <Redirect
                  to={{
                    pathname: "/keyring/unlock",
                    state: { from: locationRouter.pathname },
                  }}
                />
              )}

              {areKeyringsUnlocked && isAllowedQueryParamPage(pathFromQuery) && (
                <Redirect
                  to={{
                    pathname: pathFromQuery,
                    state: { from: locationRouter.pathname },
                  }}
                />
              )}
            </ErrorBoundary>
          </CorePage>
        </CSSTransition>
      </TransitionGroup>
    </Route>
  )
}

export default PrivateRoute
