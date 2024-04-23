import { browser, startMain } from "@pelagus/pelagus-background"
import {
  FeatureFlags,
  isEnabled,
  RuntimeFlag,
} from "@pelagus/pelagus-background/features"
import localStorageShim from "@pelagus/pelagus-background/utils/local-storage-shim"
import { ONBOARDING_ROOT } from "@pelagus/pelagus-ui/pages/Onboarding/Tabbed/Routes"

/**
 * Tracks when a service worker was last alive and extends the service worker
 * lifetime by writing the current time to extension storage every 20 seconds.
 * You should still prepare for unexpected termination - for example, if the
 * extension process crashes or your extension is manually stopped at
 * chrome://serviceworker-internals.
 */
let heartbeatInterval: NodeJS.Timeout

async function runHeartbeat() {
  await browser.storage.local.set({ "last-heartbeat": new Date().getTime() })
}

/**
 * Starts the heartbeat interval which keeps the service worker alive. Call
 * this sparingly when you are doing work which requires persistence, and call
 * stopHeartbeat once that work is complete.
 */
async function startHeartbeat() {
  // Run the heartbeat once at service worker startup.
  runHeartbeat().then(() => {
    // Then again every 20 seconds.
    heartbeatInterval = setInterval(runHeartbeat, 20 * 1000)
  })
}

export async function stopHeartbeat() {
  clearInterval(heartbeatInterval)
}

startHeartbeat()

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
