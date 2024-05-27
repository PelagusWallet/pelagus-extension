import browser from "webextension-polyfill"
import {
  EXTERNAL_PORT_NAME,
  PORT_HEALTH_CHECK_INTERVAL_IN_MILLISECONDS,
  PORT_RECONNECT_TIMEOUT_IN_MILLISECONDS,
  PROVIDER_BRIDGE_TARGET,
  WINDOW_PROVIDER_TARGET,
} from "@tallyho/provider-bridge-shared"

const windowOriginAtLoadTime = window.location.origin

function performHealthCheck(port: browser.Runtime.Port): void {
  port.postMessage({
    request: {
      method: "tally_healthCheck",
      origin: windowOriginAtLoadTime,
    },
  })
}

export function connectProviderBridge(): void {
  let portHealthInterval: NodeJS.Timeout | null = null
  let port = browser.runtime.connect({ name: EXTERNAL_PORT_NAME })

  window.addEventListener("message", (event) => {
    if (
      event.origin === windowOriginAtLoadTime && // we want to recieve msgs only from the in-page script
      event.source === window && // we want to recieve msgs only from the in-page script
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
      // eslint-disable-next-line no-console
      console.log(
        `%c content: inpage > background: ${JSON.stringify(event.data)}`,
        "background: #bada55; color: #222"
      )

      port.postMessage(event.data)
    }
  })

  // let's grab the internal config that also has chainId info
  // we send the config on port initialization, but that needs to
  // be as fast as possible, so we omit the chainId information
  // from that payload to save the service call
  port.postMessage({
    request: { method: "tally_getConfig", origin: windowOriginAtLoadTime },
  })

  function setupListeners(port: browser.Runtime.Port): void {
    port.onMessage.addListener((data) => {
      // TODO: replace with better logging before v1. Now it's invaluable in debugging.
      // eslint-disable-next-line no-console
      console.log(
        `%c content: background > inpage: ${JSON.stringify(data)}`,
        "background: #222; color: #bada55"
      )
      window.postMessage(
        {
          ...data,
          target: WINDOW_PROVIDER_TARGET,
        },
        windowOriginAtLoadTime
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
    setupListeners(port)
  }

  setupListeners(port)

  portHealthInterval = setInterval(
    () => performHealthCheck(port),
    PORT_HEALTH_CHECK_INTERVAL_IN_MILLISECONDS
  )
}

export function injectTallyWindowProvider(): void {
  if (document.contentType !== "text/html") return

  try {
    const container = document.head || document.documentElement
    const scriptTag = document.createElement("script")
    // this makes the script loading blocking which is good for us
    // bc we want to load before anybody has a chance to temper w/ the window obj
    scriptTag.setAttribute("async", "false")
    scriptTag.src = browser.runtime.getURL("window-provider.js")
    container.insertBefore(scriptTag, container.children[0])
  } catch (e) {
    throw new Error(
      `Pelagus: oh nos the content-script failed to initilaize the Pelagus window provider.
        ${e}
        It's time for a seppuku...🗡`
    )
  }
}
