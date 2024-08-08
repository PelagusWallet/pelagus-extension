import React, { ReactElement } from "react"
import { Route, Redirect } from "react-router-dom"
import { Location } from "history"
import { ErrorBoundary } from "react-error-boundary"
import { useAreKeyringsUnlocked } from "../hooks"
import CorePage from "../components/Core/CorePage"
import ErrorFallback from "../pages/ErrorFallback"

const PrivateRoute = ({
  Component,
  location,
  path,
  hasTopBar,
}: {
  Component: (...args: any[]) => ReactElement
  location: Location
  path: string
  hasTopBar: boolean
}) => {
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)

  return (
    <Route path={path} key={path}>
      <CorePage hasTopBar={hasTopBar}>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Component location={location} />

          {!areKeyringsUnlocked && <Redirect to="/keyring/unlock" />}
        </ErrorBoundary>
      </CorePage>
    </Route>
  )
}

export default PrivateRoute
