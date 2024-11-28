import React, { ReactElement, useState, useRef, useEffect } from "react"
import classNames from "classnames"
import { useLocalStorage } from "../../hooks"
import { triggerManualBalanceUpdate } from "@pelagus/pelagus-background/redux-slices/accounts"
import { useBackgroundDispatch } from "../../hooks"

export default function BalanceReloader(): ReactElement {
  const dispatch = useBackgroundDispatch()

  const [isSpinning, setIsSpinning] = useState(false)

  // 0 = never
  const [timeWhenLastReloaded, setTimeWhenLastReloaded] = useLocalStorage(
    "timeWhenLastReloaded",
    "0"
  )

  const timeGapBetweenRunningReloadMs = 60000 * 2
  const minLoadTimeMs = 2000 // Minimum load time
  const maxSpinTimeMs = 90000 // Maximum spin time (90 seconds)

  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const onClick = async () => {
    const currentTime = new Date().getTime()
    setIsSpinning(true)

    if (
      Number(timeWhenLastReloaded) + timeGapBetweenRunningReloadMs <
      currentTime
    ) {
      setTimeWhenLastReloaded(`${currentTime}`)
    }

    // Start a timeout to stop spinning after maxSpinTimeMs
    const spinTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        setIsSpinning(false)
      }
    }, maxSpinTimeMs)

    const startTime = Date.now()
    await dispatch(triggerManualBalanceUpdate())
    const elapsedTime = Date.now() - startTime

    if (elapsedTime < minLoadTimeMs) {
      await new Promise(resolve =>
        setTimeout(resolve, minLoadTimeMs - elapsedTime)
      )
    }

    if (isMountedRef.current) {
      clearTimeout(spinTimeout) // Clear the timeout if update completes before maxSpinTimeMs
      setIsSpinning(false)
    }
  }

  return (
    <button
      type="button"
      disabled={isSpinning}
      className={classNames("reload", { spinning: isSpinning })}
      onClick={onClick}
    >
      <style jsx>{`
        .reload {
          mask-image: url("./images/reload@2x.png");
          mask-size: cover;
          background-color: #96969b;
          width: 17px;
          height: 17px;
        }
        .reload:hover {
          background-color: var(--trophy-gold);
        }
        .reload:disabled {
          pointer-events: none;
        }
        .spinning {
          animation: spin 1s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
        .spinning:hover {
          background-color: #fff;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  )
}
