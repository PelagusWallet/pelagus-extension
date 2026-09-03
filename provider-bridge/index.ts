import browser from "webextension-polyfill"
import {
  EXTERNAL_PORT_NAME,
  PROVIDER_BRIDGE_TARGET,
  WINDOW_PROVIDER_TARGET,
  PORT_RECONNECT_TIMEOUT_IN_MILLISECONDS,
  PORT_HEALTH_CHECK_INTERVAL_IN_MILLISECONDS,
  PELAGUS_HEALTH_CHECK_METHOD,
  PELAGUS_GET_CONFIG_METHOD,
} from "@pelagus-provider/provider-bridge-shared"
import PendingRequestTracker from "./pending-requests"

const WINDOW_ORIGIN_AT_LOAD_TIME = window.location.origin

function postResponseToWindow(response: unknown): void {
  window.postMessage(
    {
      ...(response as Record<string, unknown>),
      target: WINDOW_PROVIDER_TARGET,
    },
    WINDOW_ORIGIN_AT_LOAD_TIME
  )
}

function performHealthCheck(port: browser.Runtime.Port): void {
  port.postMessage({
    request: {
      method: PELAGUS_HEALTH_CHECK_METHOD,
      origin: WINDOW_ORIGIN_AT_LOAD_TIME,
    },
  })
}

function contentScriptEventsListener(
  event: MessageEvent,
  port: browser.Runtime.Port,
  pendingRequests: PendingRequestTracker
): void {
  if (
    event.origin === WINDOW_ORIGIN_AT_LOAD_TIME && // we want to receive msgs only from the in-page script
    event.source === window && // we want to receive msgs only from the in-page script
    event.data.target === PROVIDER_BRIDGE_TARGET
  ) {
    // if dapp wants to connect let's grab its details
    if (
      event.data.request.method === "quai_requestAccounts" ||
      event.data.request.method === "eth_requestAccounts" ||
      event.data.request.method === "wallet_addEthereumChain"
    ) {
      const faviconElements: NodeListOf<HTMLLinkElement> =
        window.document.querySelectorAll("link[rel*='icon']")
      const largestFavicon = [...faviconElements].sort((el) =>
        parseInt(el.sizes?.toString().split("x")[0], 10)
      )[0]
      const faviconUrl = largestFavicon?.href ?? ""
      const { title } = window.document ?? ""

      event.data.request.params.push(title, faviconUrl)
    }

    pendingRequests.track(event.data)
    try {
      port.postMessage(event.data)
    } catch {
      pendingRequests.takeDisconnectResponses().forEach(postResponseToWindow)
    }
  }
}

export function initializePelagusProviderBridge(): void {
  let portHealthInterval: NodeJS.Timeout | null = null
  let port: browser.Runtime.Port
  const pendingRequests = new PendingRequestTracker()

  function startHealthChecks(): void {
    if (portHealthInterval !== null) clearInterval(portHealthInterval)
    portHealthInterval = setInterval(
      () => performHealthCheck(port),
      PORT_HEALTH_CHECK_INTERVAL_IN_MILLISECONDS
    )
  }

  function connect(): browser.Runtime.Port {
    const connectedPort = browser.runtime.connect({ name: EXTERNAL_PORT_NAME })

    connectedPort.onMessage.addListener((data) => {
      pendingRequests.settle(data)
      postResponseToWindow(data)
    })

    connectedPort.onDisconnect.addListener(() => {
      if (portHealthInterval !== null) clearInterval(portHealthInterval)
      portHealthInterval = null

      pendingRequests.takeDisconnectResponses().forEach(postResponseToWindow)

      setTimeout(() => {
        port = connect()
        startHealthChecks()
      }, PORT_RECONNECT_TIMEOUT_IN_MILLISECONDS)
    })

    // We send the config on initialization to save a service call and again
    // after a reconnect so the in-page provider receives current state.
    connectedPort.postMessage({
      request: {
        method: PELAGUS_GET_CONFIG_METHOD,
        origin: WINDOW_ORIGIN_AT_LOAD_TIME,
      },
    })
    performHealthCheck(connectedPort)

    return connectedPort
  }

  port = connect()

  window.addEventListener("message", (event: MessageEvent) =>
    contentScriptEventsListener(event, port, pendingRequests)
  )

  startHealthChecks()
}

export function injectPelagusWindowProvider(): void {
  if (document.contentType !== "text/html") return

  try {
    const container = document.head || document.documentElement
    const scriptTag = document.createElement("script")

    scriptTag.setAttribute("async", "false")
    scriptTag.src = browser.runtime.getURL("window-provider.js")
    container.insertBefore(scriptTag, container.children[0])
  } catch (e) {
    throw new Error(
      `Pelagus: the content-script failed to initialize the Pelagus window provider. ${e}`
    )
  }
}
