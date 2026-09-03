export const DEFAULT_AUTO_LOCK_INTERVAL_MINUTES = 24 * 60

export function shouldAutoLock(
  now: number,
  lastInternalWalletActivity: number | null,
  lastExternalWalletActivity: number | null,
  autoLockInterval: number
): boolean {
  if (
    lastInternalWalletActivity === null ||
    lastExternalWalletActivity === null
  ) {
    return true
  }

  return (
    now - lastInternalWalletActivity >= autoLockInterval &&
    now - lastExternalWalletActivity >= autoLockInterval
  )
}
