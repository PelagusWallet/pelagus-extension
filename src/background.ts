import { browser, startMain } from "@pelagus/pelagus-background"
import {
  FeatureFlags,
  isEnabled,
  RuntimeFlag,
} from "@pelagus/pelagus-background/features"
import localStorageShim from "@pelagus/pelagus-background/utils/local-storage-shim"
import { ONBOARDING_ROOT } from "@pelagus/pelagus-ui/pages/Onboarding/Tabbed/Routes"

const QNS_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

type QNSParsedRoute = {
  target: string
  path?: string
  query?: string
}

function qnsRendererUrl(route: QNSParsedRoute): string | null {
  const target = route.target.trim()
  if (!target) return null

  const params = new URLSearchParams()
  if (QNS_ADDRESS_PATTERN.test(target)) {
    params.set("module", target)
  } else {
    params.set("name", target)
  }

  if (route.path) params.set("path", route.path)
  if (route.query) params.set("query", route.query)

  return browser.runtime.getURL(`qns-renderer.html?${params.toString()}`)
}

function qnsRouteFromInput(
  input: string,
  options: { allowBareTarget?: boolean } = {}
): QNSParsedRoute | null {
  const value = input.trim()
  if (!value) return null

  if (value.toLowerCase().startsWith("qns://")) {
    try {
      const url = new URL(value)
      return {
        target: decodeURIComponent(url.hostname),
        path: url.pathname || undefined,
        query: url.search ? url.search.slice(1) : undefined,
      }
    } catch (_) {
      const rawTarget = value.slice(6).split(/[/?#]/)[0] || ""
      return { target: decodeURIComponent(rawTarget) }
    }
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      const host = url.hostname.toLowerCase()
      if (host.endsWith(".quai")) {
        return {
          target: decodeURIComponent(host.slice(0, -5)),
          path: url.pathname || undefined,
          query: url.search ? url.search.slice(1) : undefined,
        }
      }
    } catch (_) {
      return null
    }
  }

  const bareHost = value.split(/[/?#]/)[0].toLowerCase()
  if (bareHost.endsWith(".quai")) {
    return {
      target: decodeURIComponent(bareHost.slice(0, -5)),
    }
  }

  if (options.allowBareTarget) return { target: value }
  return null
}

function qnsLoaderUrl(
  input: string,
  options: { allowBareTarget?: boolean } = {}
): string | null {
  const route = qnsRouteFromInput(input, options)
  if (!route) return null
  return qnsRendererUrl(route)
}

function installQNSUrlInterceptor() {
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return

    const loaderUrl = qnsLoaderUrl(changeInfo.url)
    if (!loaderUrl) return

    browser.tabs.update(tabId, { url: loaderUrl }).catch((error) => {
      console.warn("Failed to open QNS loader URL", error)
    })
  })
}

function installQNSQuaiHostInterceptor() {
  if (!browser.webNavigation?.onBeforeNavigate) return

  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return

    const loaderUrl = qnsLoaderUrl(details.url)
    if (!loaderUrl) return

    browser.tabs.update(details.tabId, { url: loaderUrl }).catch((error) => {
      console.warn("Failed to open QNS renderer URL", error)
    })
  })
}

function installQNSOmnibox() {
  if (!browser.omnibox) return

  browser.omnibox.setDefaultSuggestion({
    description: "Open QNS name or module address",
  })

  browser.omnibox.onInputEntered.addListener((text, disposition) => {
    const loaderUrl = qnsLoaderUrl(text, { allowBareTarget: true })
    if (!loaderUrl) return

    if (disposition === "newForegroundTab" || disposition === "newBackgroundTab") {
      browser.tabs.create({
        active: disposition === "newForegroundTab",
        url: loaderUrl,
      })
      return
    }

    browser.tabs.update({ url: loaderUrl }).catch(() => {
      browser.tabs.create({ url: loaderUrl })
    })
  })
}

/**
 * Tracks when a service worker was last alive and extends the service worker
 * lifetime by writing the current time to extension storage every 20 seconds.
 * You should still prepare for unexpected termination - for example, if the
 * extension process crashes or your extension is manually stopped at
 * chrome://serviceworker-internals.
 */
let heartbeatInterval: NodeJS.Timeout

async function runHeartbeat() {
  await browser.storage.local.set({ "last-heartbeat": new Date().getTime() })
}

/**
 * Starts the heartbeat interval which keeps the service worker alive. Call
 * this sparingly when you are doing work which requires persistence, and call
 * stopHeartbeat once that work is complete.
 */
async function startHeartbeat() {
  // Run the heartbeat once at service worker startup.
  runHeartbeat().then(() => {
    // Then again every 20 seconds.
    heartbeatInterval = setInterval(runHeartbeat, 20 * 1000)
  })
}

export async function stopHeartbeat() {
  clearInterval(heartbeatInterval)
}

startHeartbeat()
installQNSQuaiHostInterceptor()
installQNSUrlInterceptor()
installQNSOmnibox()

browser.runtime.onInstalled.addListener((obj) => {
  if (obj.reason === "install") {
    const url = browser.runtime.getURL(ONBOARDING_ROOT)
    browser.tabs.create({ url })
  }
  /**
   * Runtime feature flags should be clean from Local Storage if the build has change and SWITCH_RUNTIME_FLAGS is off.
   * If SWITCH_RUNTIME_FLAGS is on then it should keep the previous feature flags settings.
   */
  if (
    obj.reason === "update" &&
    !isEnabled(FeatureFlags.SWITCH_RUNTIME_FLAGS)
  ) {
    Object.keys(RuntimeFlag).forEach((flagName) =>
      localStorageShim.removeItem(flagName)
    )
  }
})

startMain()
