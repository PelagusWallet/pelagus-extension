import { migrateReduxState } from "../migrations"
import { initialState } from "../ui"

describe("Redux state migrations", () => {
  it.each([10, 60, 7 * 24 * 60])(
    "preserves an existing %i-minute auto-lock interval",
    (autoLockInterval) => {
      const previousState = {
        ui: {
          settings: {
            autoLockInterval,
            theme: "dark",
          },
        },
        untouched: { value: true },
      }

      expect(migrateReduxState(previousState, 3)).toBe(previousState)
    }
  )

  it("uses the one-day auto-lock interval for new wallets", () => {
    expect(initialState.settings.autoLockInterval).toBe(24 * 60)
  })
})
