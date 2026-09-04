import { DEFAULT_AUTO_LOCK_INTERVAL_MINUTES } from "../../constants/auto-lock"

type PreviousState = {
  ui: {
    settings: {
      [setting: string]: unknown
    }
    [sliceKey: string]: unknown
  }
  [otherSlice: string]: unknown
}

export default (oldState: Record<string, unknown>): PreviousState => {
  const previousState = oldState as PreviousState

  // Product migration for 1.0.60: give every existing user the new 24-hour
  // default once. Subsequent user selections are kept.
  return {
    ...previousState,
    ui: {
      ...previousState.ui,
      settings: {
        ...previousState.ui.settings,
        autoLockInterval: DEFAULT_AUTO_LOCK_INTERVAL_MINUTES,
      },
    },
  }
}
