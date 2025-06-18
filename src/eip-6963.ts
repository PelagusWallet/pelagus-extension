import { EventEmitter } from "events"

const EIP6963_PROVIDER_INFO = {
  uuid: "io.pelaguswallet.wallet",
  name: "Pelagus Wallet",
  icon: "https://pelaguswallet.io/docs/img/PelagusLogoSquare.png",
  rdns: "io.pelaguswallet.wallet"
}

export class EIP6963Provider extends EventEmitter {
  private provider: any

  constructor(provider: any) {
    super()
    this.provider = provider
  }

  get info() {
    return EIP6963_PROVIDER_INFO
  }

  // Forward all provider methods
  request = (...args: any[]) => {
    if (!this.provider) {
      throw new Error("Provider not initialized")
    }
    return this.provider.request(...args)
  }
  override on = (...args: any[]) => {
    if (!this.provider) {
      throw new Error("Provider not initialized")
    }
    return this.provider.on(...args)
  }
  override removeListener = (...args: any[]) => {
    if (!this.provider) {
      throw new Error("Provider not initialized")
    }
    return this.provider.removeListener(...args)
  }
  isConnected = () => {
    if (!this.provider) {
      return false
    }
    return this.provider.isConnected()
  }
  isPelagus = true
}

// Create singleton provider
let provider: EIP6963Provider | null = null

// Initialize provider when window.pelagus is available
function initializeProvider() {
  if (window.pelagus && !provider) {
    provider = new EIP6963Provider(window.pelagus)
  }
}

// Optional shim for WalletConnect v2 dApps
if (!window.ethereum) {
  Object.defineProperty(window, 'ethereum', {
    get() {
      return window.pelagus
    },
    configurable: true,
  })
}

// Check for late injections
function checkNewEthereum() {
  if (window.ethereum && window.ethereum !== window.pelagus && window.walletRouter) {
    window.walletRouter.addProvider(window.ethereum)
  }
}

// Announce provider to dApps
export function announceProvider() {
  // Initialize provider if not already initialized
  initializeProvider()

  if (!provider) {
    // If provider is not ready, wait for window.pelagus
    const checkInterval = setInterval(() => {
      if (window.pelagus) {
        clearInterval(checkInterval)
        initializeProvider()
        announceProvider()
      }
    }, 100)
    return
  }

  const detail = {
    info: EIP6963_PROVIDER_INFO,
    provider
  }

  // Dispatch the event
  window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
    detail
  }))

  // Listen for requests
  window.addEventListener("eip6963:requestProvider", () => {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
      detail
    }))
  })

  // Check for late injections
  setTimeout(checkNewEthereum, 0)
} 