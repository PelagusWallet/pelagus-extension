import { DEFAULT_AUTO_LOCK_INTERVAL_MINUTES } from "../../constants/auto-lock"
import { migrateReduxState, REDUX_STATE_VERSION } from "../migrations"

describe("Redux state migrations", () => {
  it("sets existing wallets to the one-day auto-lock interval", () => {
    const previousState = {
      ui: {
        settings: {
          autoLockInterval: 10,
          theme: "dark",
        },
      },
      untouched: { value: true },
    }

    expect(migrateReduxState(previousState, 3)).toEqual({
      ui: {
        settings: {
          autoLockInterval: DEFAULT_AUTO_LOCK_INTERVAL_MINUTES,
          theme: "dark",
        },
      },
      untouched: { value: true },
    })
    expect(previousState.ui.settings.autoLockInterval).toEqual(10)
  })

  it("preserves later user changes once the migration has run", () => {
    const currentState = {
      ui: {
        settings: {
          autoLockInterval: 7 * 24 * 60,
        },
      },
    }

    expect(migrateReduxState(currentState, REDUX_STATE_VERSION)).toBe(
      currentState
    )
  })
})
