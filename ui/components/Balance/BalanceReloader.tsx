import React, { ReactElement, useState, useRef, useEffect } from "react"
import classNames from "classnames"
import { triggerManualBalanceUpdate } from "@pelagus/pelagus-background/redux-slices/accounts"
import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import { useBackgroundDispatch } from "../../hooks"

export default function BalanceReloader(): ReactElement {
  const dispatch = useBackgroundDispatch()

  const [isSpinning, setIsSpinning] = useState(false)

  const minLoadTimeMs = 2000 // Minimum load time
  const refreshTimeoutMs = 90000

  const isMountedRef = useRef(true)
  const refreshInProgressRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const onClick = async () => {
    if (refreshInProgressRef.current) return

    refreshInProgressRef.current = true
    setIsSpinning(true)
    const startTime = Date.now()
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined
    const timeoutError = new Error("Balance refresh timed out")
    try {
      const result = await Promise.race([
        dispatch(triggerManualBalanceUpdate()),
        new Promise<never>((_, reject) => {
          refreshTimeout = setTimeout(
            () => reject(timeoutError),
            refreshTimeoutMs
          )
        }),
      ])
      if (
        triggerManualBalanceUpdate.rejected.match(result as { type: unknown })
      ) {
        throw new Error("Balance refresh failed")
      }
    } catch (error) {
      if (isMountedRef.current) {
        dispatch(
          setSnackbarConfig({
            message:
              error === timeoutError
                ? "Refresh is taking longer than expected. It may still complete."
                : "Unable to refresh balances. Please try again.",
          })
        ).catch(() => undefined)
      }
    } finally {
      clearTimeout(refreshTimeout)
      const elapsedTime = Date.now() - startTime
      if (elapsedTime < minLoadTimeMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, minLoadTimeMs - elapsedTime)
        )
      }

      refreshInProgressRef.current = false
      if (isMountedRef.current) setIsSpinning(false)
    }
  }

  return (
    <button
      type="button"
      aria-label="Refresh balances"
      disabled={isSpinning}
      className={classNames("reload", { spinning: isSpinning })}
      onClick={onClick}
    >
      <style jsx>{`
        .reload {
          mask-image: url("./images/reload@2x.png");
          mask-size: cover;
          background-color: var(--secondary-text);
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
          background-color: var(--primary-text);
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
