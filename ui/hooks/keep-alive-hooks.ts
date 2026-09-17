import { useEffect } from "react"
import { runtime } from "webextension-polyfill"
import {
  MONITOR_ACTIVITY_MESSAGE,
  ONBOARDING_MONITOR_PORT_NAME,
} from "@pelagus/pelagus-background/constants/ports"

// Chromium terminates an extension service worker once it has been idle for
// kServiceWorkerDefaultIdleDelayInSeconds (30s). Each message restarts that
// countdown — the browser takes a keepalive around delivery, which cancels and
// reschedules the idle timer — so ping well inside the window. Holding the
// port open is not itself enough: Chromium counts the messages, not the
// channel.
export const KEEP_ALIVE_INTERVAL_MS = 20 * 1000

/**
 * Pings the background service worker over a port, so flows that keep
 * unrecoverable state in its memory — tabbed onboarding holds the generated
 * recovery phrase and the unlocked vault — are not interrupted by the worker
 * being terminated.
 *
 * Best-effort: a backgrounded tab has its timers throttled below the ping
 * rate, so the worker can still be lost. Callers must handle that (onboarding
 * recovers by asking for the password again), rather than assume this holds.
 */
export const useKeepBackgroundAlive = (): void => {
  useEffect(() => {
    let port: ReturnType<typeof runtime.connect> | null = null
    let stopped = false

    const connect = () => {
      if (stopped || port) return

      try {
        const opened = runtime.connect(undefined, {
          name: ONBOARDING_MONITOR_PORT_NAME,
        })
        // Reconnecting happens on the next tick rather than from this
        // listener, so a worker that keeps dropping us cannot spin a loop.
        opened.onDisconnect.addListener(() => {
          if (port === opened) port = null
        })
        port = opened
      } catch {
        // Extension context torn down (reload/update); the next tick retries.
        port = null
      }
    }

    connect()

    const timer = setInterval(() => {
      if (!port) {
        connect()
        return
      }

      try {
        port.postMessage(MONITOR_ACTIVITY_MESSAGE)
      } catch {
        port = null
      }
    }, KEEP_ALIVE_INTERVAL_MS)

    return () => {
      stopped = true
      clearInterval(timer)
      try {
        port?.disconnect()
      } catch {
        // Already gone; nothing to release.
      }
      port = null
    }
  }, [])
}
