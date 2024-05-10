import { createSelector } from "@reduxjs/toolkit"
import { RootState } from ".."
import { isDefined } from "../../lib/utils/type-guards"
import {
  KeyringAccountSigner,
  PrivateKeyAccountSigner,
} from "../../services/keyring"
import { AccountSigner, ReadOnlyAccountSigner } from "../../services/signing"
import { HexString } from "../../types"
import {
  selectKeyringsByAddresses,
  selectPrivateKeyWalletsByAddress,
} from "./keyringsSelectors"
import { selectCurrentAccount } from "./uiSelectors"
import { QUAI_CONTEXTS } from "../../constants"

// FIXME: This has a duplicate in `accountSelectors.ts`, but importing causes a dependency cycle
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
          if (keyring.id === null) {
            return undefined
          }

          allAccountsSeen.add(address)
          const shard = getShardFromAddress(address)
          return [
            address,
            {
              type: "keyring",
              keyringID: keyring.id,
              shard,
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
          if (wallet.id === null) {
            return undefined
          }

          allAccountsSeen.add(address)

          return [
            address,
            {
              type: "private-key",
              walletID: wallet.id,
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

export const getShardFromAddress = function (address: string): string {
  const shardData = QUAI_CONTEXTS.filter((obj) => {
    const num = Number(address.substring(0, 4))
    const start = Number(`0x${obj.byte[0]}`)
    const end = Number(`0x${obj.byte[1]}`)
    return num >= start && num <= end
  })
  if (shardData.length === 0) {
    throw new Error("Invalid address")
  }
  return shardData[0].shard
}
