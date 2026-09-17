import browser from "webextension-polyfill"
import { Store as ProxyStore } from "webext-redux"
import patchDeepDiff from "webext-redux/lib/strategies/deepDiff/patch"
import { AnyAction } from "@reduxjs/toolkit"
import Main from "./main"
import { encodeJSON, decodeJSON } from "./lib/utils"
import { RootState } from "./redux-slices"

export { browser }
export type { RootState }
export type BackgroundDispatch = Main["store"]["dispatch"]

export const BACKGROUND_DISCONNECTED_ERROR = "background-disconnected"

/**
 * Bound for a dispatch sent after the background is known to be gone. A
 * restarted worker registers its dispatch listener only once `Main` has
 * finished starting, so a dispatch that races that startup gets no response at
 * all; anything sent afterwards does work, which is what lets a flow holding
 * its own state (onboarding holds the recovery phrase) still complete.
 */
const DISCONNECTED_DISPATCH_TIMEOUT_MS = 15 * 1000

/**
 * webext-redux dispatches over `runtime.sendMessage` and reads `resp.error` in
 * the response callback. When no receiver handles the message — the worker is
 * gone, or restarted and has not registered its listener yet — Chromium runs
 * that callback with no arguments and sets `runtime.lastError`
 * (one_time_message_handler.cc, DisconnectOpener). Reading `.error` off
 * `undefined` throws inside the callback, so the promise `dispatch` returned
 * never settles and every awaiting UI action hangs silently and forever.
 *
 * The port backing the proxy store disconnects when the worker dies, so use it
 * to fail those dispatches instead of leaving them pending.
 */
function guardedDispatch(
  proxyStore: ProxyStore<RootState, AnyAction>
): ProxyStore<RootState, AnyAction>["dispatch"] | null {
  // The port is created in the ProxyStore constructor and is not part of its
  // public type, so reach for it defensively.
  const { port } = proxyStore as unknown as {
    port?: { onDisconnect?: { addListener: (cb: () => void) => void } }
  }

  if (!port?.onDisconnect) return null

  let disconnected = false
  // Only in-flight dispatches are tracked; each removes itself once it
  // settles, so a long-lived UI does not accumulate them.
  const pendingRejections = new Set<() => void>()

  port.onDisconnect.addListener(() => {
    disconnected = true
    pendingRejections.forEach((reject) => reject())
    pendingRejections.clear()
  })

  const { dispatch } = proxyStore

  // Race every dispatch against a signal that the background is gone. Before
  // the port drops that signal is the disconnect itself; afterwards it is a
  // timeout, because a dispatch sent while the worker restarts gets no reply.
  // Either way the dispatch is still attempted — it wakes a dead worker, so a
  // retry can succeed — it just can no longer hang forever.
  return ((action: AnyAction) => {
    let stopWaiting = () => {}

    const backgroundGone = new Promise<never>((_, reject) => {
      const fail = () => reject(new Error(BACKGROUND_DISCONNECTED_ERROR))

      if (disconnected) {
        const timer = setTimeout(fail, DISCONNECTED_DISPATCH_TIMEOUT_MS)
        stopWaiting = () => clearTimeout(timer)
        return
      }

      pendingRejections.add(fail)
      stopWaiting = () => pendingRejections.delete(fail)
    })

    return Promise.race([dispatch(action), backgroundGone]).finally(stopWaiting)
  }) as ProxyStore<RootState, AnyAction>["dispatch"]
}

/**
 * Creates and returns a new webext-redux proxy store. This is a redux store
 * that works like any redux store, except that its contents and actions are
 * proxied to and from the master background store created when the API package
 * is first imported.
 *
 * The returned Promise resolves once the proxy store is ready and hydrated
 * with the current background store data.
 */
export async function newProxyStore(): Promise<
  ProxyStore<RootState, AnyAction>
> {
  const proxyStore = new ProxyStore({
    serializer: encodeJSON,
    deserializer: decodeJSON,
    patchStrategy: patchDeepDiff,
  })

  const dispatch = guardedDispatch(proxyStore)
  if (dispatch) proxyStore.dispatch = dispatch

  await proxyStore.ready()
  return proxyStore
}

/**
 * Starts the API subsystems, including all services.
 */
export async function startMain(): Promise<Main> {
  const mainService = await Main.create()
  await mainService.startService()
  return mainService.started()
}
