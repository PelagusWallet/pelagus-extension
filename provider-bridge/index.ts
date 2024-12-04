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

const WINDOW_ORIGIN_AT_LOAD_TIME = window.location.origin

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
  port: browser.Runtime.Port
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

    // TODO: replace with better logging before v1. Now it's invaluable in debugging.
    console.log(
      `%c content: inpage > background: ${JSON.stringify(event.data)}`,
      "background: #bada55; color: #222"
    )

    port.postMessage(event.data)
  }
}

export function initializePelagusProviderBridge(): void {
  let portHealthInterval: NodeJS.Timeout | null = null
  let port = browser.runtime.connect({ name: EXTERNAL_PORT_NAME })

  window.addEventListener("message", (event: MessageEvent) =>
    contentScriptEventsListener(event, port)
  )

  // we send the config on port initialization to save the service call
  port.postMessage({
    request: {
      method: PELAGUS_GET_CONFIG_METHOD,
      origin: WINDOW_ORIGIN_AT_LOAD_TIME,
    },
  })

  function backgroundEventsListener(port: browser.Runtime.Port): void {
    port.onMessage.addListener((data) => {
      // TODO: replace with better logging before v1. Now it's invaluable in debugging.
      console.log(
        `%c content: background > inpage: ${JSON.stringify(data)}`,
        "background: #222; color: #bada55"
      )

      window.postMessage(
        {
          ...data,
          target: WINDOW_PROVIDER_TARGET,
        },
        WINDOW_ORIGIN_AT_LOAD_TIME
      )
    })

    port.onDisconnect.addListener(() => {
      if (portHealthInterval !== null) clearInterval(portHealthInterval)
      setTimeout(reconnect, PORT_RECONNECT_TIMEOUT_IN_MILLISECONDS)
    })

    performHealthCheck(port)
  }

  function reconnect(): void {
    port = browser.runtime.connect({ name: EXTERNAL_PORT_NAME })
    backgroundEventsListener(port)
  }

  backgroundEventsListener(port)

  portHealthInterval = setInterval(
    () => performHealthCheck(port),
    PORT_HEALTH_CHECK_INTERVAL_IN_MILLISECONDS
  )
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
