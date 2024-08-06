import {
  WindowListener,
  WindowRequestEvent,
} from "@pelagus-provider/provider-bridge-shared"
import PelagusWindowProvider from "@pelagus-provider/window-provider"

const PELAGUS_OBJECT_PROPERTY = "pelagus"
const ETHEREUM_OBJECT_PROPERTY = "ethereum"
const WALLET_ROUTER_OBJECT_PROPERTY = "walletRouter"

const DETECT_PROVIDER_INITIALIZATION_EVENT = "quai#initialized"

const pelagusWindowProvider: PelagusWindowProvider = new PelagusWindowProvider({
  postMessage: (data: WindowRequestEvent) =>
    window.postMessage(data, window.location.origin),
  addEventListener: (fn: WindowListener) =>
    window.addEventListener("message", fn, false),
  removeEventListener: (fn: WindowListener) =>
    window.removeEventListener("message", fn, false),
  origin: window.location.origin,
})

// The window object is considered unsafe, because other extensions could have modified them before this script is run.
// For 100% certainty we could create an iframe here, store the references and then destroy the iframe.
// https://speakerdeck.com/fransrosen/owasp-appseceu-2018-attacking-modern-web-technologies?slide=95
Object.defineProperty(window, PELAGUS_OBJECT_PROPERTY, {
  value: pelagusWindowProvider,
  writable: true,
  configurable: false,
})

Object.defineProperty(window, WALLET_ROUTER_OBJECT_PROPERTY, {
  value: {
    currentProvider: window.pelagus,
    lastInjectedProvider: window.ethereum,
    pelagusProvider: window.pelagus,
    providers: [
      ...new Set([
        window.pelagus,
        // eslint-disable-next-line no-nested-ternary
        ...(window.ethereum
          ? // let's use the providers that has already been registered
            Array.isArray(window.ethereum.providers)
            ? [...window.ethereum.providers, window.ethereum]
            : [window.ethereum]
          : []),
      ]),
    ],
    shouldSetPelagusForCurrentProvider(shouldSetPelagus: boolean) {
      if (shouldSetPelagus && this.currentProvider !== this.pelagusProvider) {
        this.currentProvider = this.pelagusProvider
      } else if (
        !shouldSetPelagus &&
        this.currentProvider === this.pelagusProvider
      ) {
        this.currentProvider = this.lastInjectedProvider ?? this.pelagusProvider
      }
    },
    addProvider(newProvider: WalletProvider) {
      if (!this.providers.includes(newProvider)) {
        this.providers.push(newProvider)
      }

      this.lastInjectedProvider = newProvider
    },
  },
  writable: true,
  configurable: false,
})

// Some popular dapps depend on the entire window.ethereum equality between component renders
// to detect provider changes.  We need to cache the walletRouter proxy we return here or
// these dapps may incorrectly detect changes in the provider where there are none.
let cachedWindowEthereumProxy: WindowEthereum

// We need to save the current provider at the time we cache the proxy object,
// so we can recognize when the default wallet behavior is changed. When the
// default wallet is changed we are switching the underlying provider.
let cachedCurrentProvider: WalletProvider

Object.defineProperty(window, ETHEREUM_OBJECT_PROPERTY, {
  get() {
    if (!window.walletRouter) {
      throw new Error(
        `window.${WALLET_ROUTER_OBJECT_PROPERTY} is expected to be set to change the injected provider on window.${ETHEREUM_OBJECT_PROPERTY}.`
      )
    }

    if (
      cachedWindowEthereumProxy &&
      cachedCurrentProvider === window.walletRouter.currentProvider
    )
      return cachedWindowEthereumProxy

    cachedWindowEthereumProxy = new Proxy(window.walletRouter.currentProvider, {
      get(target, prop, receiver) {
        if (
          window.walletRouter &&
          !(prop in window.walletRouter.currentProvider) &&
          prop in window.walletRouter
        ) {
          // let's publish the api of `window.walletRoute` also on `window.ethereum` for better discoverability
          // @ts-expect-error ts accepts symbols as index only from 4.4
          return window.walletRouter[prop]
        }

        return Reflect.get(target, prop, receiver)
      },
    })
    cachedCurrentProvider = window.walletRouter.currentProvider

    return cachedWindowEthereumProxy
  },
  set(newProvider) {
    window.walletRouter?.addProvider(newProvider)
  },
  configurable: true,
})

window.dispatchEvent(new Event(DETECT_PROVIDER_INITIALIZATION_EVENT))
