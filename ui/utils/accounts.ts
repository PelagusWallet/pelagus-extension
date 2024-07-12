import { AccountType } from "@pelagus/pelagus-background/redux-slices/accounts"
import { AccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"

export const isAccountWithSecrets = (accountType: AccountType): boolean =>
  accountType === AccountType.Imported ||
  accountType === AccountType.Internal ||
  accountType === AccountType.PrivateKey

export const searchAccountsHandle = (
  searchValue: string,
  accounts: AccountTotal[]
): AccountTotal[] => {
  if (!searchValue) return accounts

  const searchValueToLowerCase = searchValue.toLowerCase()
  return accounts?.filter((item: AccountTotal) => {
    const name = item.name?.toLowerCase()
    const address = item.address?.toLowerCase()
    const shard =
      item?.accountSigner?.type === "keyring" &&
      item.accountSigner?.zone?.toLowerCase() // TODO-MIGRATION

    return (
      name?.includes(searchValueToLowerCase) ||
      address?.includes(searchValueToLowerCase) ||
      (shard && shard.includes(searchValueToLowerCase))
    )
  })
}
