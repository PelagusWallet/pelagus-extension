/**
 * Names of the runtime ports the UI opens to the background service worker,
 * and the message used to signal activity over them.
 *
 * Kept in their own module so UI code can reference them without importing
 * `background/main`, which pulls the whole service graph into the module
 * graph (and, in tests, breaks mocks that rely on it not being loaded).
 */
export const POPUP_MONITOR_PORT_NAME = "popup-monitor"
export const ONBOARDING_MONITOR_PORT_NAME = "onboarding-monitor"
export const MONITOR_ACTIVITY_MESSAGE = "activity"
