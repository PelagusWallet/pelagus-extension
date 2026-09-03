import {
  DEFAULT_AUTO_LOCK_INTERVAL_MINUTES,
  shouldAutoLock,
} from "../constants/auto-lock"

describe(shouldAutoLock, () => {
  const oneDay = DEFAULT_AUTO_LOCK_INTERVAL_MINUTES * 60 * 1000

  it("uses a one-day default interval", () => {
    expect(DEFAULT_AUTO_LOCK_INTERVAL_MINUTES).toEqual(1440)
  })

  it("keeps the wallet open until the full interval has elapsed", () => {
    expect(shouldAutoLock(oneDay - 1, 0, 0, oneDay)).toEqual(false)
    expect(shouldAutoLock(oneDay, 0, 0, oneDay)).toEqual(true)
  })

  it("keeps the wallet open while either activity clock is recent", () => {
    expect(shouldAutoLock(oneDay, 1, 0, oneDay)).toEqual(false)
    expect(shouldAutoLock(oneDay, 0, 1, oneDay)).toEqual(false)
  })

  it("locks an unlocked keyring with incomplete activity timestamps", () => {
    expect(shouldAutoLock(oneDay, null, 0, oneDay)).toEqual(true)
    expect(shouldAutoLock(oneDay, 0, null, oneDay)).toEqual(true)
  })
})
