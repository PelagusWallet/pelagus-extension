import { createSelector } from "@reduxjs/toolkit"
import { getZoneForAddress } from "quais"
import { RootState } from ".."
import { isDefined } from "../../lib/utils/type-guards"
import {
  KeyringAccountSigner,
  PrivateKeyAccountSigner,
} from "../../services/keyring/types"
import { AccountSigner, ReadOnlyAccountSigner } from "../../services/signing"
import { HexString } from "../../types"
import {
  selectKeyringsByAddresses,
  selectPrivateKeyWalletsByAddress,
} from "./keyringsSelectors"
import { selectCurrentAccount } from "./uiSelectors"

// FIXME: importing causes a dependency cycle
const getAllAddresses = createSelector(
  (state: RootState) => state.account,
  (account) => [
    ...new Set(
      Object.values(account.accountsData.evm).flatMap((chainAddresses) =>
        Object.keys(chainAddresses)
      )
    ),
  ]
)

export const selectAccountSignersByAddress = createSelector(
  getAllAddresses,
  selectKeyringsByAddresses,
  selectPrivateKeyWalletsByAddress,
  (allAddresses, keyringsByAddress, privateKeyWalletsByAddress) => {
    const allAccountsSeen = new Set<string>()

    const keyringEntries = Object.entries(keyringsByAddress)
      .map(
        ([address, keyring]): [HexString, KeyringAccountSigner] | undefined => {
          if (keyring.id === null) return undefined

          allAccountsSeen.add(address)
          const zone = getZoneForAddress(address)
          return [
            address,
            {
              type: "keyring",
              keyringID: keyring.id,
              // @ts-ignore TODO-MIGRATION
              zone,
            },
          ]
        }
      )
      .filter(isDefined)

    const privateKeyEntries = Object.entries(privateKeyWalletsByAddress)
      .map(
        ([address, wallet]):
          | [HexString, PrivateKeyAccountSigner]
          | undefined => {
          if (wallet.id === null) return undefined

          allAccountsSeen.add(address)
          const zone = getZoneForAddress(address)

          return [
            address,
            {
              type: "private-key",
              walletID: wallet.id,
              // @ts-ignore TODO-MIGRATION
              zone,
            },
          ]
        }
      )
      .filter(isDefined)

    const readOnlyEntries: [string, typeof ReadOnlyAccountSigner][] =
      allAddresses
        .filter((address) => !allAccountsSeen.has(address))
        .map((address) => [address, ReadOnlyAccountSigner])

    const entriesByPriority: [string, AccountSigner][] = [
      ...readOnlyEntries,
      ...privateKeyEntries,
      ...keyringEntries,
    ]

    return Object.fromEntries(entriesByPriority)
  }
)

export const selectCurrentAccountSigner = createSelector(
  selectAccountSignersByAddress,
  selectCurrentAccount,
  (signingAccounts, selectedAccount) => signingAccounts[selectedAccount.address]
)
