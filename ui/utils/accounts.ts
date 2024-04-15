import { AccountType } from "@pelagus/pelagus-background/redux-slices/accounts"

export const isAccountWithSecrets = (accountType: AccountType): boolean =>
  accountType === AccountType.Imported ||
  accountType === AccountType.Internal ||
  accountType === AccountType.PrivateKey
