import { browser, startMain } from "@pelagus/pelagus-background"
import {
  FeatureFlags,
  isEnabled,
  RuntimeFlag,
} from "@pelagus/pelagus-background/features"
import localStorageShim from "@pelagus/pelagus-background/utils/local-storage-shim"
import { ONBOARDING_ROOT } from "@pelagus/pelagus-ui/pages/Onboarding/Tabbed/Routes"

browser.runtime.onInstalled.addListener((obj) => {
  if (obj.reason === "install") {
    const url = browser.runtime.getURL(ONBOARDING_ROOT)
    browser.tabs.create({ url })
  }
  /**
   * Runtime feature flags should be clean from Local Storage if the build has change and SWITCH_RUNTIME_FLAGS is off.
   * If SWITCH_RUNTIME_FLAGS is on then it should keep the previous feature flags settings.
   */
  if (
    obj.reason === "update" &&
    !isEnabled(FeatureFlags.SWITCH_RUNTIME_FLAGS)
  ) {
    Object.keys(RuntimeFlag).forEach((flagName) =>
      localStorageShim.removeItem(flagName)
    )
  }
})

startMain()
