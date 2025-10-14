import { selectKeyringStatus } from "@pelagus/pelagus-background/redux-slices/selectors"
import { selectSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import React, { ReactElement, useEffect, useState } from "react"
import { AnyAction } from "redux"
import { useHistory } from "react-router-dom"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import KeyringSetPassword from "../../../Keyring/KeyringSetPassword"
import KeyringUnlock from "../../../Keyring/KeyringUnlock"
import SharedLoadingSpinner from "../../../Shared/SharedLoadingSpinner"

type SignerKeyringSigningProps = {
  signActionCreator: () => AnyAction
  redirectToActivityPage?: boolean
  onSigningError?: () => void
}

export default function SignerKeyringSigning({
  signActionCreator,
  redirectToActivityPage,
  onSigningError,
}: SignerKeyringSigningProps): ReactElement {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const keyringStatus = useBackgroundSelector(selectKeyringStatus)
  const snackbarConfig = useBackgroundSelector(selectSnackbarConfig)
  const [signingInitiated, setSigningInitiated] = useState(false)
  const [showLoadingScreen, setShowLoadingScreen] = useState(false)
  const [hasError, setHasError] = useState(false)


  // Monitor snackbar for Ledger errors
  useEffect(() => {
    if (signingInitiated && showLoadingScreen && snackbarConfig.message) {
      const message = snackbarConfig.message
      
      // Check if this is a Ledger error or insufficient funds message
      const isRecoverableError =
        message.includes("unlock your Ledger") ||
        message.includes("rejected on the Ledger") ||
        message.includes("install the Quai app") ||
        message.includes("allow opening the Quai app") ||
        message.includes("Contract Data is enabled") ||
        message.includes("app was locked") ||
        message.includes("Security conditions") ||
        message.includes("Wrong app is open") ||
        message.includes("app might not support") ||
        message.includes("but need a") || // Device mismatch errors
        message.includes("Transport was disconnected") || // Transport disconnection errors
        message.toLowerCase().includes("insufficient funds")
      
      if (isRecoverableError) {
        // Reset local states and mark that we had an error
        setShowLoadingScreen(false)
        setSigningInitiated(false)
        setHasError(true)
        
        // Call parent callback to reset the UI back to Sign Transaction page
        // Since we're not clearing transaction state in main.ts for Ledger errors,
        // the component shouldn't unmount now
        if (onSigningError) {
          onSigningError()
        }
      }
    }
  }, [snackbarConfig.message, signingInitiated, showLoadingScreen, onSigningError])

  // Initiate signing once keyring is ready.
  useEffect(() => {
    if (!signingInitiated && !hasError && keyringStatus === "unlocked") {
      setShowLoadingScreen(true)
      setSigningInitiated(true)

      // Dispatch the signing action
      // Note: sendTransaction thunk just emits an event and returns immediately
      // It doesn't wait for actual signing or propagate errors
      dispatch(signActionCreator())
      
      // The actual signing happens asynchronously in main.ts
      // If there's a Ledger error, it will:
      // 1. Show a snackbar notification (handled in main.ts)
      // 2. NOT emit a sendTransactionResponse error (handled in signing service)
      // 3. The popup stays open
      // 4. The snackbar monitor effect above will detect the error and reset the UI
      
      // For successful signing, the signing service will emit a success response
      // which causes the popup to close or redirect
    }
  }, [
    keyringStatus,
    signingInitiated,
    hasError,
    setSigningInitiated,
    dispatch,
    signActionCreator,
    history,
    redirectToActivityPage,
  ])

  // In this construction, keyring unlocking isn't done as a route, but in line
  // in the signing frame.
  if (keyringStatus === "uninitialized") {
    return <KeyringSetPassword />
  }
  if (keyringStatus === "locked") {
    return <KeyringUnlock />
  }


  if (showLoadingScreen) {
    return (
      <div>
        <div className="loading-screen">
          <div style={{ padding: "5px 0" }}>
            <SharedLoadingSpinner size="large" />
          </div>
          <p>Signing in progress</p>
        </div>
        <div className="loading-screen-text">
          Please do not close this window
        </div>
        <style jsx>
          {`
            .loading-screen {
              margin-top: 30px;
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: center;
              height: 200px;
            }

            .loading-screen p {
              font-size: 22px;
              margin-left: 10px;
            }

            .loading-screen-text {
              margin-top: 10px;
              font-size: 18px;
              color: var(--secondary-text);
              text-align: center;
            }
          `}
        </style>
      </div>
    )
  }

  // If the keyring is ready, we don't render anything as signing should be
  // quick; we may want a brief spinner.
  return <></>
}
