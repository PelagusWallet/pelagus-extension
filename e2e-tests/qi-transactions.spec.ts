/**
 * E2E tests for Qi transactions between two wallets.
 *
 * Prerequisites:
 * - Extension built: `yarn build` or `yarn start`
 * - Wallet A needs both Qi (for sending) and Quai (for payment channel notification)
 *
 * Run: `yarn test:e2e:qi`
 *
 * First run: creates fresh wallets and prints payment codes/addresses.
 *   Fund them externally, then run again.
 * Subsequent runs: profiles persist, wallets are already funded.
 */
import { dualWalletTest as test, expect, WalletContext } from "./utils/dualWalletFixture"
import { getOnboardingPage } from "./utils/onboarding"
import OnboardingHelper from "./utils/onboarding"
import {
  DEFAULT_PASSWORD,
  QI_SEND_AMOUNT,
  QI_CONVERT_AMOUNT,
  ORCHARD_CHAIN_ID,
} from "./utils/constants"

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Create a new wallet or unlock an existing one. All through real UI. */
async function ensureWalletReady(
  wallet: WalletContext,
  name: string
): Promise<void> {
  const isInit = await wallet.sw.isWalletInitialized(wallet.serviceWorker)

  if (!isInit) {
    // First run: open popup.html to trigger onboarding tab creation
    // (popup.html auto-closes and opens tab.html#/onboarding when no wallet exists)
    console.log(`[${name}] Triggering onboarding tab...`)
    const triggerPage = await wallet.context.newPage()
    await triggerPage.goto(
      `chrome-extension://${wallet.extensionId}/popup.html`,
      { waitUntil: "load" }
    ).catch(() => {}) // popup may close immediately
    await new Promise((r) => setTimeout(r, 2000))

    // Debug: list all open pages
    const pages = wallet.context.pages()
    console.log(`[${name}] Open pages (${pages.length}):`)
    for (const p of pages) {
      console.log(`  - ${p.url()}`)
    }

    // Find the onboarding page directly
    const onboardingPage = pages.find((p) => p.url().includes("onboarding"))
    if (!onboardingPage) {
      console.log(`[${name}] ERROR: No onboarding page found!`)
      throw new Error("Onboarding page not found — check extension loaded correctly")
    }
    console.log(`[${name}] Found onboarding page: ${onboardingPage.url()}`)

    // Click "Create new wallet" directly with an explicit timeout
    console.log(`[${name}] Looking for 'Create new wallet' button...`)
    const createButton = onboardingPage.getByRole("button", { name: "Create new wallet" })
    await createButton.waitFor({ state: "visible", timeout: 15000 })
    console.log(`[${name}] Button found, clicking...`)
    await createButton.click()
    console.log(`[${name}] Clicked 'Create new wallet'`)

    // Continue with password setup
    console.log(`[${name}] Filling password...`)
    await onboardingPage.locator('input[name="password"]').fill(DEFAULT_PASSWORD)
    await onboardingPage.locator('input[name="confirm_password"]').fill(DEFAULT_PASSWORD)
    await onboardingPage.getByRole("button", { name: "Anchors Away!" }).click({ timeout: 10000 })
    console.log(`[${name}] Password set, creating seed phrase...`)

    // Create and verify seed
    await onboardingPage.getByRole("button", { name: "Create recovery phrase" }).click({ timeout: 10000 })

    // Wait for seed words to appear (async generation)
    await onboardingPage.locator(".seed_phrase .word").first().waitFor({ state: "visible", timeout: 30000 })

    const seedWords = await onboardingPage.locator(".seed_phrase .word .text").allTextContents()
    console.log(`[${name}] Got ${seedWords.length} seed words`)

    await onboardingPage.getByRole("button", { name: "Next" }).click({ timeout: 10000 })

    // Verify seed words — read placeholder numbers, click matching remaining words
    console.log(`[${name}] Verifying seed words...`)
    await new Promise((r) => setTimeout(r, 2000)) // let page render

    // Debug: what's on the page
    const pageText = await onboardingPage.locator("body").innerText()
    console.log(`[${name}] Page text: ${pageText.slice(0, 300)}`)

    const wordContainers = onboardingPage.locator(".word_container")
    const containerCount = await wordContainers.count()
    console.log(`[${name}] Found ${containerCount} word_container elements`)

    const wordButtons = onboardingPage.locator(".word_buttons button")
    const buttonCount = await wordButtons.count()
    console.log(`[${name}] Found ${buttonCount} word_buttons`)

    if (containerCount === 0) {
      throw new Error("No word containers found — UI structure may have changed")
    }
    const count = containerCount

    for (let i = 0; i < count; i++) {
      const container = wordContainers.nth(i)
      const numberText = await container.locator(".number").textContent()
      const wordIndex = parseInt(numberText?.replace(".", "") || "0") - 1
      const correctWord = seedWords[wordIndex]
      console.log(`[${name}]   Filling position ${wordIndex + 1}: "${correctWord}"`)

      // Click the placeholder to make it active
      await container.locator(".word_box").click({ timeout: 5000 })
      // Find and click the correct word from remaining buttons
      await onboardingPage.locator(`.word_buttons button:text-is("${correctWord}")`).click({ timeout: 5000 })
    }
    console.log(`[${name}] All ${count} words filled`)

    // Verify and finalize
    await onboardingPage.getByRole("button", { name: "Verify recovery phrase" }).click({ timeout: 10000 })
    console.log(`[${name}] Verified, finalizing...`)
    await onboardingPage.getByRole("button", { name: "Finalize" }).click({ timeout: 10000 })

    await expect(
      onboardingPage.getByRole("heading", { name: "Welcome to Pelagus" })
    ).toBeVisible({ timeout: 30000 })
    console.log(`[${name}] Wallet created successfully`)
    console.log(`[${name}] Wallet created successfully`)
  }

  // The fixture already opens popup and handles unlock.
  // For onboarding (first run), we need to close onboarding tabs and reopen popup.
  if (!isInit) {
    // Close onboarding tabs
    for (const page of wallet.context.pages()) {
      if (page !== wallet.popup) await page.close().catch(() => {})
    }
    // Reopen popup after onboarding
    if (!wallet.popup || wallet.popup.isClosed()) {
      wallet.popup = await wallet.context.newPage()
      await wallet.popup.goto(
        `chrome-extension://${wallet.extensionId}/popup.html`,
        { waitUntil: "load" }
      )
      await wallet.popup.setViewportSize({ width: 384, height: 600 })
      // Unlock if needed
      const passwordInput = wallet.popup.locator("#signing_password")
      if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log(`[${name}] Unlocking via UI...`)
        await passwordInput.fill(DEFAULT_PASSWORD)
        await wallet.popup.getByRole("button", { name: "Unlock" }).click({ timeout: 5000 })
        await wallet.popup.waitForSelector('[data-testid="top_menu_network_switcher"]', { timeout: 60000 })
      }
    }
  }

  // The fixture handles Orchard + Qi wallet selection
  console.log(`[${name}] Popup ready, triggering Qi sync...`)

  // Force a sync to pick up any newly received Qi (may fail if RPC is down)
  try {
    await wallet.sw.triggerQiSync(wallet.serviceWorker)
    await wallet.sw.waitForQiSync(wallet.serviceWorker, 30000)
    console.log(`[${name}] Qi sync complete`)
  } catch {
    console.log(`[${name}] Qi sync timed out — RPC may be unavailable, continuing with cached balance`)
  }
}

/** Select Orchard testnet via the real UI network switcher. */
async function selectOrchardTestnet(wallet: WalletContext): Promise<void> {
  console.log(`  [selectOrchard] Getting current chain ID...`)
  const currentChainID = await wallet.sw.getCurrentChainID(wallet.serviceWorker)
  console.log(`  [selectOrchard] Current chain: ${currentChainID}`)
  if (currentChainID === ORCHARD_CHAIN_ID) {
    console.log(`  [selectOrchard] Already on Orchard, skipping`)
    return
  }

  const { popup } = wallet
  console.log(`  [selectOrchard] Clicking network switcher...`)
  await popup.getByTestId("top_menu_network_switcher").click({ timeout: 10000 })
  console.log(`  [selectOrchard] Network switcher opened`)
  await new Promise((r) => setTimeout(r, 500))

  // Debug: dump page content after clicking switcher
  const bodyText = await popup.locator("body").innerText()
  console.log(`  [selectOrchard] Page content: ${bodyText.slice(0, 500)}`)

  // Enable test networks toggle — click the actual checkbox, not the label
  const toggleCheckbox = popup.locator('button[role="checkbox"]')
  if (await toggleCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    const isChecked = await toggleCheckbox.getAttribute("aria-checked")
    if (isChecked !== "true") {
      console.log(`  [selectOrchard] Enabling test networks toggle...`)
      await toggleCheckbox.click()
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  console.log(`  [selectOrchard] Clicking Orchard Testnet...`)
  await popup.locator("text=Orchard Testnet").click({ timeout: 5000 })
  await popup.waitForTimeout(1000)
  console.log(`  [selectOrchard] Done`)
}

/** Unlock the popup UI if the unlock screen is showing. Fixture usually handles this. */
async function unlockPopupIfNeeded(wallet: WalletContext): Promise<void> {
  if (!wallet.popup || wallet.popup.isClosed()) return
  const passwordInput = wallet.popup.locator("#signing_password")
  if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await passwordInput.fill(DEFAULT_PASSWORD)
    await wallet.popup.getByRole("button", { name: "Unlock" }).click({ timeout: 5000 })
    await wallet.popup.waitForSelector('[data-testid="top_menu_network_switcher"]', {
      timeout: 60000,
    })
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe.serial("Qi Transactions", () => {
  let walletAPaymentCode: string
  let walletBPaymentCode: string
  let walletAFunded: boolean
  let walletBFunded: boolean

  test("Setup: Initialize Wallet A", async ({ walletA }) => {
    await ensureWalletReady(walletA, "Wallet A")

    walletAPaymentCode = await walletA.sw.getPaymentCode(walletA.serviceWorker)
    expect(walletAPaymentCode).toBeTruthy()

    const balance = await walletA.sw.getQiBalance(walletA.serviceWorker)
    walletAFunded = BigInt(balance) > 0n

    const quaiAddress = await walletA.sw.getQuaiAddress(walletA.serviceWorker)

    console.log(`\n────────────────────────────────────────`)
    console.log(`Wallet A payment code: ${walletAPaymentCode}`)
    console.log(`Wallet A Quai address: ${quaiAddress}`)
    console.log(`Wallet A Qi balance:   ${balance}`)
    console.log(`Wallet A funded:       ${walletAFunded}`)
    console.log(`────────────────────────────────────────\n`)

    if (!walletAFunded) {
      console.log("⚠ Fund Wallet A with Qi (and Quai for payment channel) then re-run tests")
    }
  })

  test("Setup: Initialize Wallet B", async ({ walletB }) => {
    await ensureWalletReady(walletB, "Wallet B")

    walletBPaymentCode = await walletB.sw.getPaymentCode(walletB.serviceWorker)
    expect(walletBPaymentCode).toBeTruthy()

    const balance = await walletB.sw.getQiBalance(walletB.serviceWorker)
    walletBFunded = BigInt(balance) > 0n

    console.log(`\n────────────────────────────────────────`)
    console.log(`Wallet B payment code: ${walletBPaymentCode}`)
    console.log(`Wallet B Qi balance:   ${balance}`)
    console.log(`Wallet B funded:       ${walletBFunded}`)
    console.log(`────────────────────────────────────────\n`)
  })

  test("Wallet A sends Qi to Wallet B", async ({ walletA }) => {
    test.skip(!walletAFunded, "Wallet A has no Qi balance — fund it first")

    // Fixture already handles Orchard + Qi wallet selection
    const { popup } = walletA
    console.log(`Send test: sending to ${walletBPaymentCode?.slice(0, 20)}...`)

    // Take screenshot to see what's actually visible
    await popup.screenshot({ path: "test-results/before-send-click.png" })
    console.log("Send test: screenshot saved to test-results/before-send-click.png")

    // Debug: check what's at the Send button's position
    const sendInfo = await popup.evaluate(() => {
      const sendBtn = document.querySelector('[aria-label="Send"]') as HTMLElement
      if (!sendBtn) return "Send button not found"
      const rect = sendBtn.getBoundingClientRect()
      // Check what element is at the button's center
      const elementAtPoint = document.elementFromPoint(rect.x + rect.width/2, rect.y + rect.height/2)
      return JSON.stringify({
        buttonTag: sendBtn.tagName,
        buttonRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
        elementAtPoint: elementAtPoint?.tagName + '.' + elementAtPoint?.className?.toString().slice(0, 50),
        isSameElement: elementAtPoint === sendBtn || sendBtn.contains(elementAtPoint),
        sendBtnDisabled: (sendBtn as any).disabled,
      })
    })
    console.log(`Send test: send button info: ${sendInfo}`)

    // Click Send button
    console.log("Send test: clicking Send button...")
    await popup.locator('[aria-label="Send"]').first().click({ timeout: 10000 })
    await new Promise((r) => setTimeout(r, 2000))

    await popup.screenshot({ path: "test-results/after-send-click.png" })

    const inputCount = await popup.locator("input").count()
    console.log(`Send test: inputs after click: ${inputCount}`)

    // Fill form via both UI input AND Redux dispatch to ensure state sync
    console.log("Send test: filling payment code...")
    const toInput = popup.locator(".to-input")
    await toInput.waitFor({ state: "visible", timeout: 10000 })
    await toInput.fill(walletBPaymentCode)
    // Also trigger input event to ensure React picks it up
    await toInput.dispatchEvent("input")
    await toInput.dispatchEvent("change")

    console.log("Send test: filling amount...")
    const amountInput = popup.locator(".amount-input")
    await amountInput.fill(QI_SEND_AMOUNT)
    await amountInput.dispatchEvent("input")
    await amountInput.dispatchEvent("change")

    await new Promise((r) => setTimeout(r, 1000))

    // Debug: check form state before clicking Next
    const toValue = await popup.locator(".to-input").inputValue()
    const amountValue = await popup.locator(".amount-input").inputValue()
    const nextBtn = popup.getByRole("button", { name: /Next/i })
    const nextDisabled = await nextBtn.isDisabled()
    console.log(`Send test: form state — to: ${toValue.slice(0, 20)}... (${toValue.length} chars), amount: ${amountValue}, Next disabled: ${nextDisabled}`)

    // Click Next
    console.log("Send test: clicking Next...")
    await nextBtn.click({ timeout: 10000 })
    await new Promise((r) => setTimeout(r, 3000))

    // Debug: what's on screen after Next
    const afterNext = await popup.locator("body").innerText()
    console.log(`Send test: after Next (${afterNext.length} chars): ${afterNext.slice(0, 400)}`)
    const buttonsAfterNext = await popup.locator("button").allInnerTexts()
    console.log(`Send test: buttons: ${buttonsAfterNext.filter(b => b.trim()).join(", ")}`)

    // Handle Payment Channel Modal (appears on first send to a new recipient)
    const paymentChannelModal = popup.locator("text=Payment channel")
    if (await paymentChannelModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log("Send test: Payment channel modal appeared, confirming...")
      await popup.getByRole("button", { name: /Confirm/i }).click({ timeout: 5000 })
      await new Promise((r) => setTimeout(r, 2000))
    } else {
      console.log("Send test: No payment channel modal")
    }

    // Wait for confirmation page
    console.log("Send test: waiting for Confirm Transaction page...")
    await popup.waitForSelector("text=Confirm Transaction", { timeout: 15000 })
    console.log("Send test: on confirmation page, clicking Send...")

    // Click Send on confirmation page
    await popup.getByRole("button", { name: "Send" }).click({ timeout: 10000 })
    console.log("Send test: Send clicked, waiting for transaction to complete via service worker...")

    // The popup may close during the transaction — don't rely on it.
    // Instead, poll the service worker for balance change.
    const balanceBefore = await walletA.sw.getQiBalance(walletA.serviceWorker)
    console.log(`Send test: balance before send: ${balanceBefore}`)
    const sendResult = await walletA.sw.waitForQiTransactionComplete(walletA.serviceWorker, balanceBefore)
    console.log(`Send test: transaction result: ${sendResult}`)
    expect(sendResult).toContain("confirmed")
    console.log("Send test: Wallet A → Wallet B Qi send confirmed!")
  })

  test("Wallet B receives the Qi", async ({ walletB }) => {
    test.skip(!walletAFunded, "Skipped — Wallet A send was skipped")

    // Poll for balance — may take multiple syncs for tx to propagate and mailbox to update
    console.log("Receive test: polling for Wallet B balance...")
    let balance = "0"
    for (let attempt = 1; attempt <= 5; attempt++) {
      await walletB.sw.triggerQiSync(walletB.serviceWorker)
      await walletB.sw.waitForQiSync(walletB.serviceWorker)
      balance = await walletB.sw.getQiBalance(walletB.serviceWorker)
      console.log(`Receive test: attempt ${attempt}/5, balance: ${balance}`)
      if (BigInt(balance) > 0n) break
      if (attempt < 5) {
        console.log("Receive test: waiting 10s before next sync...")
        await new Promise((r) => setTimeout(r, 10000))
      }
    }

    expect(BigInt(balance)).toBeGreaterThan(0n)
  })

  test("Qi-to-Quai conversions: 10 successful + 2 reverts", async ({ walletA }) => {
    test.setTimeout(900000) // 15 minutes — 12 conversions + revert waits

    // Check balance directly (don't rely on setup test's walletAFunded)
    await walletA.sw.triggerQiSync(walletA.serviceWorker)
    try { await walletA.sw.waitForQiSync(walletA.serviceWorker, 30000) } catch {}
    const initialBalance = await walletA.sw.getQiBalance(walletA.serviceWorker)
    console.log(`Conversion test: initial balance: ${initialBalance}`)
    if (BigInt(initialBalance) < 15000n) {
      console.log("Skipping — need at least 15 QI for conversion tests")
      test.skip(true, "Wallet A needs at least 15 QI")
      return
    }

    const { popup } = walletA

    // Helper: perform a single Qi-to-Quai conversion
    async function doConversion(amount: string, slippage: string, label: string): Promise<{ balanceBefore: string; balanceAfter: string }> {
      console.log(`\n[${label}] Starting conversion: ${amount} QI, slippage ${slippage}%`)

      // Navigate to convert page
      await popup.locator('[aria-label="Convert"]').first().click({ timeout: 10000 })
      await new Promise((r) => setTimeout(r, 2000))

      // Fill amount
      await popup.locator(".amount-input").waitFor({ state: "visible", timeout: 10000 })
      await popup.locator(".amount-input").fill(amount)

      // Set slippage via custom input
      const customSlippageInput = popup.locator(".custom-slippage-input")
      await customSlippageInput.click()
      await customSlippageInput.fill(slippage)
      // Click elsewhere to trigger the change
      await popup.locator(".amount-input").click()
      await new Promise((r) => setTimeout(r, 500))

      // Get balance before
      const balanceBefore = await walletA.sw.getQiBalance(walletA.serviceWorker)
      console.log(`[${label}] Balance before: ${balanceBefore}`)

      // Click Next
      await popup.getByRole("button", { name: /Next/i }).click({ timeout: 10000 })
      await new Promise((r) => setTimeout(r, 2000))

      // Wait for confirmation page
      await popup.waitForSelector("text=Confirm Conversion", { timeout: 15000 })
      console.log(`[${label}] On confirmation page, clicking Convert...`)

      // Verify slippage is displayed correctly
      const detailsText = await popup.locator(".details-wrapper").innerText().catch(() => "")
      console.log(`[${label}] Details: ${detailsText.replace(/\n/g, " | ")}`)

      // Click Convert
      await popup.getByRole("button", { name: "Convert" }).click({ timeout: 10000 })
      console.log(`[${label}] Convert clicked, waiting for result...`)

      // Wait for balance change via service worker
      const result = await walletA.sw.waitForQiTransactionComplete(walletA.serviceWorker, balanceBefore, 120000)
      console.log(`[${label}] Result: ${result}`)

      const balanceAfter = await walletA.sw.getQiBalance(walletA.serviceWorker)

      // Wait for the success/error modal, then close it to return home
      // Don't reload popup.html — that breaks the proxy store connection
      await new Promise((r) => setTimeout(r, 5000))
      // Try to close any modal/drawer by clicking its close button
      const closeBtn = popup.locator('[aria-label="Close"]').first()
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click()
        await new Promise((r) => setTimeout(r, 1000))
      }
      // If still not on home, click the go-back header
      const goBack = popup.locator('[aria-label="Go back"]').or(popup.locator("text=Go back"))
      if (await goBack.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await goBack.first().click()
        await new Promise((r) => setTimeout(r, 1000))
      }

      return { balanceBefore, balanceAfter }
    }

    // ─── 10 Successful conversions (1 QI each, any slippage) ───
    for (let i = 1; i <= 10; i++) {
      const { balanceBefore, balanceAfter } = await doConversion("1", "5", `Success ${i}/10`)
      console.log(`[Success ${i}/10] Balance: ${balanceBefore} → ${balanceAfter}`)
      // Balance should have changed (previously locked Qi may unlock, so just verify the conversion completed)
      expect(balanceAfter).not.toBe(balanceBefore)
    }

    // ─── 2 Failing conversions (100 QI, 0% slippage → forced revert) ───
    // The tx confirms on-chain but the conversion reverts — Qi is returned as locked
    const lockedBefore = await walletA.sw.getQiLockedBalance(walletA.serviceWorker)
    console.log(`\nLocked balance before reverts: ${lockedBefore}`)

    for (let i = 1; i <= 2; i++) {
      const spendableBefore = await walletA.sw.getQiBalance(walletA.serviceWorker)
      const { balanceBefore, balanceAfter } = await doConversion("100", "0", `Revert ${i}/2`)
      console.log(`[Revert ${i}/2] Spendable: ${balanceBefore} → ${balanceAfter}`)

      // The spendable balance should decrease (100 QI was sent)
      // Wait a few minutes for the tx to confirm and revert, then sync
      console.log(`[Revert ${i}/2] Waiting 2 minutes for tx to confirm + revert...`)
      await new Promise((r) => setTimeout(r, 120000))

      // Sync to pick up the locked refund UTXOs
      console.log(`[Revert ${i}/2] Syncing wallet...`)
      await walletA.sw.triggerQiSync(walletA.serviceWorker)
      try { await walletA.sw.waitForQiSync(walletA.serviceWorker, 60000) } catch {}

      const spendableAfter = await walletA.sw.getQiBalance(walletA.serviceWorker)
      const lockedAfter = await walletA.sw.getQiLockedBalance(walletA.serviceWorker)
      console.log(`[Revert ${i}/2] After sync — spendable: ${spendableAfter}, locked: ${lockedAfter}`)
    }

    // Final balance check
    const finalSpendable = await walletA.sw.getQiBalance(walletA.serviceWorker)
    const finalLocked = await walletA.sw.getQiLockedBalance(walletA.serviceWorker)
    console.log(`\n────────────────────────────────────────`)
    console.log(`Final spendable balance: ${finalSpendable}`)
    console.log(`Final locked balance:    ${finalLocked}`)
    console.log(`────────────────────────────────────────`)

    // Locked balance should have increased from the reverted conversions
    expect(BigInt(finalLocked)).toBeGreaterThan(BigInt(lockedBefore))
    console.log("Reverted Qi detected as locked — test passed")
  })
})
