import { BrowserContext, test as base, expect, Page } from "@playwright/test"

export const getOnboardingPage = async (
  context: BrowserContext
): Promise<Page> => {
  await expect(async () => {
    const pages = context.pages()
    const onboarding = pages.find((page) => /onboarding/.test(page.url()))

    if (!onboarding) {
      throw new Error("Unable to find onboarding tab")
    }

    expect(onboarding).toHaveURL(/onboarding/)
  }).toPass()

  const onboarding = context.pages().at(-1)

  if (!onboarding) {
    // Should never happen
    throw new Error("Onboarding page closed too early")
  }

  return onboarding
}

const DEFAULT_PASSWORD = "12345678"

export default class OnboardingHelper {
  constructor(
    public readonly popup: Page,
    // public readonly backgroundPage: Page,
    public readonly context: BrowserContext
  ) {}

  async getOnboardingPage(): Promise<Page> {
    await expect(async () => {
      const pages = this.context.pages()
      const onboarding = pages.find((page) => /onboarding/.test(page.url()))

      if (!onboarding) {
        throw new Error("Unable to find onboarding tab")
      }

      expect(onboarding).toHaveURL(/onboarding/)
    }).toPass()

    const onboarding = this.context
      .pages()
      .find((page) => /onboarding/.test(page.url()))

    if (!onboarding) {
      // Should never happen
      throw new Error("Onboarding page closed too early")
    }

    return onboarding
  }

  async addReadOnlyAccount(
    addressOrName: string,
    onboardingPage?: Page
  ): Promise<void> {
    const page = onboardingPage || (await getOnboardingPage(this.context))

    await base.step("Onboard readonly address", async () => {
      await page.getByRole("button", { name: "Use existing wallet" }).click()
      await page.getByRole("button", { name: "Read-only address" }).click()
      await page.getByRole("textbox").fill(addressOrName)
      await page.getByRole("button", { name: "Preview Pelagus" }).click()

      await expect(
        page.getByRole("heading", { name: "Welcome to Pelagus" })
      ).toBeVisible()
    })
  }

  async addAccountFromSeed({
    phrase,
    onboardingPage,
  }: {
    phrase: string
    onboardingPage?: Page
  }): Promise<void> {
    const page = onboardingPage || (await getOnboardingPage(this.context))

    await base.step("Onboard readonly address", async () => {
      await page.getByRole("button", { name: "Use existing wallet" }).click()
      await page.getByRole("button", { name: "Import recovery phrase" }).click()

      const passwordInput = page.locator('input[name="password"]')

      if (await passwordInput.isVisible()) {
        await page.locator('input[name="password"]').fill(DEFAULT_PASSWORD)
        await page
          .locator('input[name="confirm_password"]')
          .fill(DEFAULT_PASSWORD)
      }

      await page.getByRole("button", { name: "Anchors Away!" }).click()

      await page
        .getByRole("textbox", { name: "Input recovery phrase" })
        .fill(phrase)

      await page.getByRole("button", { name: "Import account" }).click()
      await expect(
        page.getByRole("heading", { name: "Welcome to Pelagus" })
      ).toBeVisible()
    })
  }

  async addNewWallet(onboardingPage?: Page): Promise<void> {
    const page = onboardingPage || (await getOnboardingPage(this.context))

    await page.getByRole("button", { name: "Create new wallet" }).click()

    const passwordInput = page.locator('input[name="password"]')

    if (await passwordInput.isVisible()) {
      await page.locator('input[name="password"]').fill(DEFAULT_PASSWORD)
      await page
        .locator('input[name="confirm_password"]')
        .fill(DEFAULT_PASSWORD)
    }

    await page.getByRole("button", { name: "Anchors Away!" }).click()
    await page.getByRole("button", { name: "Create recovery phrase" }).click()

    // Verify seed
    const seedWords = (
      await page.locator(".seed_phrase .word").allTextContents()
    ).map((word) => word.replace(/-|\s/, ""))

    await page.getByRole("button", { name: "I wrote it down" }).click()

    const seedWordPlaceholders = page.getByTestId(
      "verify_seed_word_placeholder"
    )

    const wordsToVerify = (await seedWordPlaceholders.allTextContents()).map(
      (word) => Number((word.match(/\d+/) ?? ["0"])[0])
    )

    await seedWordPlaceholders.first().click()

    // eslint-disable-next-line no-restricted-syntax
    for (const wordPos of wordsToVerify) {
      const word = seedWords[wordPos - 1]

      // eslint-disable-next-line no-await-in-loop
      await page
        .getByTestId("remaining_seed_words")
        .getByRole("button", { name: word })
        .click()
    }

    await page.getByRole("button", { name: "Verify recovery phrase" }).click()

    await expect(page.getByRole("button", { name: "Verified" })).toBeVisible()

    await page.getByRole("button", { name: "Finalize" }).click()

    await expect(
      page.getByRole("heading", { name: "Welcome to Pelagus" })
    ).toBeVisible()
  }
}
