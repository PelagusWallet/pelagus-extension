import { test as base, chromium, BrowserContext, Page, Worker } from "@playwright/test"
import path from "path"
import WalletPageHelper from "./walletPageHelper"
import { ServiceWorkerHelper } from "./serviceWorkerHelper"
import { PROFILE_DIR_A, PROFILE_DIR_B } from "./constants"

export { expect } from "@playwright/test"

export type WalletContext = {
  context: BrowserContext
  serviceWorker: Worker
  extensionId: string
  popup: Page  // mutable — may be replaced if closed during onboarding
  helper: WalletPageHelper
  sw: ServiceWorkerHelper
}

type DualWalletFixtures = {
  walletA: WalletContext
  walletB: WalletContext
}

async function createWalletContext(
  profileDirRelative: string
): Promise<WalletContext & { cleanup: () => Promise<void> }> {
  const label = profileDirRelative.includes("wallet-a") ? "Wallet A" : "Wallet B"
  const log = (msg: string) => console.log(`[${label} fixture] ${msg}`)

  const pathToExtension = path.resolve(__dirname, "../../dist/chrome")
  const profileDir = path.resolve(__dirname, "../../", profileDirRelative)

  log(`Launching browser (profile: ${profileDirRelative})...`)
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
    permissions: ["clipboard-read", "clipboard-write"],
  })
  log("Browser launched")

  // Block analytics
  await context.route(/app\.posthog\.com/i, (route) =>
    route.fulfill({ json: { status: 1 } })
  )

  // Get service worker (MV3)
  log("Waiting for service worker...")
  let [serviceWorker] = context.serviceWorkers()
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 30000 })
  }
  const extensionId = serviceWorker.url().split("/")[2]
  log(`Service worker ready (extension ID: ${extensionId})`)

  const sw = new ServiceWorkerHelper()

  // Wait for background to initialize
  log("Waiting for globalThis.main...")
  await sw.waitForMain(serviceWorker)
  log("Background initialized")

  // Check if wallet needs onboarding — if so, trigger it by opening popup
  const isInit = await sw.isWalletInitialized(serviceWorker)
  if (!isInit) {
    log("Wallet not initialized — popup will trigger onboarding")
  }

  // Open popup and handle unlock
  log("Opening popup...")
  // Close any leftover pages first
  for (const page of context.pages()) {
    await page.close().catch(() => {})
  }

  let popup: Page

  if (isInit) {
    // Wallet exists — open popup, unlock via UI
    popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "load" })
    await new Promise((r) => setTimeout(r, 2000))

    // Retry if popup auto-closed (proxy store race)
    if (popup.isClosed()) {
      log("Popup closed, retrying...")
      await new Promise((r) => setTimeout(r, 2000))
      popup = await context.newPage()
      await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "load" })
      await new Promise((r) => setTimeout(r, 2000))
    }

    await popup.setViewportSize({ width: 384, height: 600 })

    // Unlock if needed
    const passwordInput = popup.locator("#signing_password")
    if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      log("Unlocking via UI...")
      await passwordInput.fill("12345678")
      await popup.getByRole("button", { name: "Unlock" }).click({ timeout: 5000 })
      await popup.waitForSelector('[data-testid="top_menu_network_switcher"]', { timeout: 60000 })
      log("Unlocked")
    }

    // Select Orchard testnet if needed
    const chainID = await sw.getCurrentChainID(serviceWorker)
    if (chainID !== "15000") {
      log("Selecting Orchard testnet...")
      await popup.getByTestId("top_menu_network_switcher").click({ timeout: 10000 })
      const toggle = popup.locator('button[role="checkbox"]')
      if (await toggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        const isChecked = await toggle.getAttribute("aria-checked")
        if (isChecked !== "true") await toggle.click()
        await new Promise((r) => setTimeout(r, 500))
      }
      await popup.locator("text=Orchard Testnet").click({ timeout: 5000 })
      await new Promise((r) => setTimeout(r, 1000))
      log("Orchard selected")
    }

    // Close any overlay panels (Dapp Connections, etc.) by pressing Escape
    log("Closing overlays with Escape...")
    await popup.keyboard.press("Escape")
    await new Promise((r) => setTimeout(r, 500))
    await popup.keyboard.press("Escape")
    await new Promise((r) => setTimeout(r, 500))

    const allText = await popup.locator("body").innerText()
    log(`Page text: ${allText.slice(0, 400)}`)

    // Check if we're already on the Qi wallet (has "Wrap Qi" button, unique to Qi view)
    const onQiWallet = await popup.locator('[aria-label="Wrap Qi"]').isVisible({ timeout: 3000 }).catch(() => false)

    if (!onQiWallet) {
      // Need to switch to Qi wallet
      log("Switching to Qi wallet...")
      // Check if account selector is open or needs to be opened
      const qiTab = popup.locator("text=Qi Wallet")
      if (await qiTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await qiTab.click()
      } else {
        // Try to find and click the account/profile area to open selector
        const profileBtn = popup.getByTestId("top_menu_profile_button")
        if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await profileBtn.click()
          await popup.locator("text=Qi Wallet").click({ timeout: 5000 })
        }
      }
      // Click Cyprus 1 in the account list
      await popup.locator("text=Cyprus 1").first().click({ timeout: 10000 })
      await popup.locator('[aria-label="Send"]').waitFor({ state: "visible", timeout: 15000 })
    }

    // Wait for Qi balance to load
    log("Waiting for Qi balance to load...")
    await new Promise((r) => setTimeout(r, 10000))
    log("Qi wallet ready")
  } else {
    // Not initialized — popup triggers onboarding tab, we'll get popup later
    popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`).catch(() => {})
    await new Promise((r) => setTimeout(r, 2000))
    // popup is likely closed, will be replaced in the test after onboarding
    if (popup.isClosed()) {
      popup = null as unknown as Page
    }
  }

  log("Fixture ready")

  const helper = popup ? new WalletPageHelper(popup, context, extensionId) : null as unknown as WalletPageHelper

  return {
    context,
    serviceWorker,
    extensionId,
    popup,
    helper,
    sw,
    cleanup: () => context.close(),
  }
}

/**
 * Playwright test fixture that provides two independent wallet browser contexts.
 * Each wallet has its own persistent profile, service worker, and popup page.
 *
 * Usage:
 *   import { dualWalletTest as test, expect } from "./utils/dualWalletFixture"
 *   test("my test", async ({ walletA, walletB }) => { ... })
 */
export const dualWalletTest = base.extend<DualWalletFixtures>({
  walletA: async ({}, use) => {
    const wallet = await createWalletContext(PROFILE_DIR_A)
    await use(wallet)
    await wallet.cleanup()
  },
  walletB: async ({}, use) => {
    const wallet = await createWalletContext(PROFILE_DIR_B)
    await use(wallet)
    await wallet.cleanup()
  },
})
