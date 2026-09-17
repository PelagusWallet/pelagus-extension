/**
 * Returned by keyring operations that failed only because the vault is locked
 * — for example after the service worker was terminated mid-onboarding. The
 * UI uses it to offer re-entering the password instead of dead-ending.
 *
 * Kept out of ./types so that module stays type-only and is still elided from
 * runtime bundles and test mocks.
 */
export const KEYRING_LOCKED_ERROR = "keyring-locked"

export const isKeyringLockedError = (errorMessage: string): boolean =>
  errorMessage === KEYRING_LOCKED_ERROR
