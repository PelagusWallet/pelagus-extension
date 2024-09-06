import React, {
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { useDispatch } from "react-redux"
import classNames from "classnames"
import {
  selectSnackbarConfig,
  resetSnackbarConfig,
  setShowingActivityDetail,
} from "@pelagus/pelagus-background/redux-slices/ui"
import {
  useBackgroundSelector,
  useDelayContentChange,
  useIsOnboarding,
} from "../../hooks"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import WalletActivityDetails from "../Wallet/WalletActivityDetails"
import { SnackBarType } from "@pelagus/pelagus-background/redux-slices/utils"
import {
  selectCurrentAccount,
  selectShowingActivityDetail,
} from "@pelagus/pelagus-background/redux-slices/selectors"

const DISMISS_MS = 2500
const DISMISS_ANIMATION_MS = 300

export default function Snackbar({
  isTabbedOnboarding = false,
}: {
  isTabbedOnboarding?: boolean
}): ReactElement {
  const dispatch = useDispatch()

  // Snackbar for tabbed onboarding should be displayed under the button in the right container on the page
  const [isOnboarding] = useState(useIsOnboarding())
  const showInRightContainer = isTabbedOnboarding ? isOnboarding : false

  const {
    message: snackbarMessage,
    withSound,
    type,
  } = useBackgroundSelector(selectSnackbarConfig)
  const shouldHide = snackbarMessage.trim() === ""
  // Delay the display message clearing to allow the animation to complete
  // before the message is hidden.
  const displayMessage = useDelayContentChange(
    snackbarMessage,
    shouldHide,
    DISMISS_ANIMATION_MS
  )

  const snackbarTimeout = useRef<number | undefined>()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const clearSnackbarTimeout = useCallback(() => {
    if (typeof snackbarTimeout.current !== "undefined") {
      clearTimeout(snackbarTimeout.current)
      snackbarTimeout.current = undefined
    }
  }, [])

  useEffect(() => {
    clearSnackbarTimeout()

    snackbarTimeout.current = window.setTimeout(() => {
      dispatch(resetSnackbarConfig())
    }, DISMISS_MS)
  }, [snackbarMessage, clearSnackbarTimeout, dispatch])

  useEffect(() => {
    window.onblur = () => {
      clearSnackbarTimeout()
      dispatch(resetSnackbarConfig())
    }
  }, [clearSnackbarTimeout, dispatch])

  useEffect(() => {
    if (!displayMessage || !withSound) return
    audioRef.current?.play()
  }, [displayMessage, withSound])

  const showingActivityDetail = useBackgroundSelector(
    selectShowingActivityDetail
  )

  const currentAddress = useBackgroundSelector(selectCurrentAccount).address

  const [isOenActivityDetails, setIsOpenActivityDetails] = useState(false)

  const handleClick = () => {
    switch (type) {
      case SnackBarType.transactionSettled:
        setIsOpenActivityDetails(true)
        return
      default:
        dispatch(resetSnackbarConfig())
    }
  }

  return (
    <div
      className={classNames("snackbar_container", {
        hidden: shouldHide,
        right_container: showInRightContainer,
      })}
      onClick={handleClick}
    >
      <audio ref={audioRef} src="./sounds/ding.mp3" preload="auto" />

      {isOenActivityDetails && (
        <SharedSlideUpMenu
          isOpen={!!showingActivityDetail}
          close={() => dispatch(setShowingActivityDetail(null))}
        >
          {showingActivityDetail && (
            <WalletActivityDetails
              activityItem={showingActivityDetail}
              activityInitiatorAddress={currentAddress}
            />
          )}
        </SharedSlideUpMenu>
      )}

      <div className="snackbar_wrap">{displayMessage}</div>
      <style jsx>
        {`
          .snackbar_container {
            position: fixed;
            z-index: 999999999;
            bottom: 72px;
            left: 0;
            right: 0;
            cursor: pointer;
          }

          .snackbar_wrap {
            max-width: 352px;
            margin: 0 auto;
            width: fit-content;
            height: 40px;
            padding: 0 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: 500;
            background: var(--green-120);
            color: var(--green-20);
            box-shadow: 0px 24px 24px rgba(0, 20, 19, 0.14),
              0px 14px 16px rgba(0, 20, 19, 0.24),
              0px 10px 12px rgba(0, 20, 19, 0.34);
            border-radius: 8px;
            transition: all ${DISMISS_ANIMATION_MS}ms ease;
            opacity: 1;
            transform: translateY(0px);
            user-select: none;
          }

          .snackbar_container.hidden {
            pointer-events: none;
            opacity: 0;
          }

          .snackbar_container.hidden .snackbar_wrap {
            padding: 0;
            transform: translateY(10px);
          }

          @media (min-width: 980px) {
            .right_container {
              right: -50%;
            }
          }
        `}
      </style>
    </div>
  )
}
