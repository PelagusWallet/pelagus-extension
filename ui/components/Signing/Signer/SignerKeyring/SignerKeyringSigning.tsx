import { selectKeyringStatus } from "@pelagus/pelagus-background/redux-slices/selectors"
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
}

export default function SignerKeyringSigning({
  signActionCreator,
  redirectToActivityPage,
}: SignerKeyringSigningProps): ReactElement {
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const keyringStatus = useBackgroundSelector(selectKeyringStatus)
  const [signingInitiated, setSigningInitiated] = useState(false)
  const [showLoadingScreen, setShowLoadingScreen] = useState(false)

  // Initiate signing once keyring is ready.
  useEffect(() => {
    if (!signingInitiated && keyringStatus === "unlocked") {
      setShowLoadingScreen(true)

      const timer = setTimeout(() => {
        setShowLoadingScreen(false)
      }, 10000) // 10 seconds timeout

      dispatch(signActionCreator()).finally(() => {
        clearTimeout(timer)
        setShowLoadingScreen(false)

        if (redirectToActivityPage) {
          history.push("/", { goTo: "activity-page" })
        }
      })

      setSigningInitiated(true)
    }
  }, [
    keyringStatus,
    signingInitiated,
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
