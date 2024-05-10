export const PAGE_ROOT = "/tab.html#"
export const ONBOARDING_ROOT = `${PAGE_ROOT}onboarding`

const OnboardingRoutes = {
  ONBOARDING_START: "/onboarding",
  ADD_WALLET: "/onboarding/add-wallet",
  SET_PASSWORD: "/onboarding/set-password",
  IMPORT_SEED: "/onboarding/import-seed",
  IMPORT_PRIVATE_KEY: "/onboarding/import-private-key",
  NEW_SEED: "/onboarding/new-seed",
  VIEW_ONLY_WALLET: "/onboarding/view-only-wallet",
  ONBOARDING_COMPLETE: "/onboarding/done",
} as const

export default OnboardingRoutes
