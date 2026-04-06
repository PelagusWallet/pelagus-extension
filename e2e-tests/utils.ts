/* eslint-disable no-empty-pattern */
import { test as base, chromium, Worker } from "@playwright/test"
import {
  FeatureFlagType,
  isEnabled,
} from "@pelagus/pelagus-background/features"
import path from "path"
import WalletPageHelper from "./utils/walletPageHelper"

// Re-exporting so we don't mix imports
export { expect } from "@playwright/test"

type WalletTestFixtures = {
  extensionId: string
  walletPageHelper: WalletPageHelper
  serviceWorker: Worker
}

/**
 * Extended instance of playwright's `test` with our fixtures
 */
export const test = base.extend<WalletTestFixtures>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, "../dist/chrome")
    const context = await chromium.launchPersistentContext("", {
      // set to some path in order to store browser session data
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      permissions: ["clipboard-read", "clipboard-write"],
    })
    // Block analytics at context level (Worker doesn't support route())
    await context.route(/app\.posthog\.com/i, async (route) =>
      route.fulfill({ json: { status: 1 } })
    )
    await use(context)
    await context.close()
  },
  serviceWorker: async ({ context }, use) => {
    // Manifest V3: use service workers instead of background pages
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent("serviceworker")
    await use(sw)
  },
  extensionId: async ({ serviceWorker }, use) => {
    const extensionId = serviceWorker.url().split("/")[2]
    await use(extensionId)
  },
  walletPageHelper: async ({ page, context, extensionId }, use) => {
    const helper = new WalletPageHelper(page, context, extensionId)
    await use(helper)
  },
})

export const skipIfFeatureFlagged = (featureFlag: FeatureFlagType): void =>
  test.skip(
    !isEnabled(featureFlag, false),
    `Feature Flag: ${featureFlag} has not been turned on for this run`
  )
