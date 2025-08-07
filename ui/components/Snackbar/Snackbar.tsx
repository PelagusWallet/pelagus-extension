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
} from "@pelagus/pelagus-background/redux-slices/ui"
import { SnackBarType } from "@pelagus/pelagus-background/redux-slices/utils"
import {
  useBackgroundSelector,
  useDelayContentChange,
  useIsOnboarding,
} from "../../hooks"
import SnackbarTransactionActivityModal from "./OnClickModals/SnackbarTransactionActivityModal"

const DISMISS_ANIMATION_MS = 500

export default function Snackbar({
  isTabbedOnboarding = false,
}: {
  isTabbedOnboarding?: boolean
}): ReactElement {
  const dispatch = useDispatch()

  // Snackbar for tabbed onboarding should be displayed under the button in the right container on the page
  const [isOnboarding] = useState(useIsOnboarding())
  const showInRightContainer = isTabbedOnboarding ? isOnboarding : false
  const [isOpenActivityDetails, setIsOpenActivityDetails] = useState(false)

  const {
    message: snackbarMessage,
    withSound,
    type,
    duration: DISMISS_MS,
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
    if (!withSound) return
    audioRef.current?.play()
  }, [withSound])

  const handleClick = () => {
    dispatch(resetSnackbarConfig())

    switch (type) {
      case SnackBarType.transactionSettled:
        setIsOpenActivityDetails(true)
        return
      default:
        dispatch(resetSnackbarConfig())
    }
  }

  return (
    <>
      <div
        className={classNames("snackbar_container", {
          hidden: shouldHide,
          right_container: showInRightContainer,
        })}
        onClick={handleClick}
      >
        <audio ref={audioRef} src="./sounds/ding.mp3" preload="auto" />

        <div className="snackbar_wrap">{displayMessage}</div>
      </div>

      {isOpenActivityDetails && (
        <SnackbarTransactionActivityModal
          setIsOpenActivityDetails={setIsOpenActivityDetails}
        />
      )}

      <style jsx>
        {`
          .snackbar_container {
            position: fixed;
            z-index: 999999999;
            top: 20px;
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
            font-size: 14px;
            font-weight: 500;
            background: var(--green-95);
            color: var(--green-40);
            border: 1px solid var(--green-60);
            border-radius: 8px;
            transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 1;
            transform: translateY(0px);
            user-select: none;
            box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
          }

          .snackbar_container.hidden {
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .snackbar_container.hidden .snackbar_wrap {
            padding: 0;
            transform: translateY(-30px);
            opacity: 0;
            transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          }

          @media (min-width: 980px) {
            .right_container {
              right: -50%;
            }
          }
        `}
      </style>
    </>
  )
}
