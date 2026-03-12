import { createSelector } from "@reduxjs/toolkit"
import { getZoneForAddress, Zone, getAddress } from "quais"
import { RootState } from ".."
import { isDefined } from "../../lib/utils/type-guards"
import {
  KeyringAccountSigner,
  PrivateKeyAccountSigner,
  LedgerAccountSigner,
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

const selectLedgerAccountsByAddress = createSelector(
  (state: RootState) => state.ledger,
  (ledgerState) => {
    const ledgerAccountsByAddress: { [address: string]: LedgerAccountSigner } = {}
    
    ledgerState.derivedAddresses.forEach((ledgerAddress) => {
      try {
        // Use checksummed address for consistent lookup
        const checksummedAddress = getAddress(ledgerAddress.address)
        const zone = getZoneForAddress(checksummedAddress) as Zone
        
        ledgerAccountsByAddress[checksummedAddress] = {
          type: "ledger",
          deviceModel: ledgerAddress.deviceModel || "Device",
          deviceId: ledgerAddress.deviceId || "unknown",
          path: ledgerAddress.path,
          zone,
        }
      } catch (error) {
        // Skip invalid addresses
        console.error("Invalid Ledger address:", ledgerAddress.address, error)
      }
    })
    
    return ledgerAccountsByAddress
  }
)

export const selectAccountSignersByAddress = createSelector(
  getAllAddresses,
  selectKeyringsByAddresses,
  selectPrivateKeyWalletsByAddress,
  selectLedgerAccountsByAddress,
  (allAddresses, keyringsByAddress, privateKeyWalletsByAddress, ledgerAccountsByAddress) => {
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

    const ledgerEntries = Object.entries(ledgerAccountsByAddress)
      .map(([address, signer]): [HexString, LedgerAccountSigner] => {
        allAccountsSeen.add(address)
        return [address, signer]
      })

    const readOnlyEntries: [string, typeof ReadOnlyAccountSigner][] =
      allAddresses
        .filter((address) => !allAccountsSeen.has(address))
        .map((address) => [address, ReadOnlyAccountSigner])

    const entriesByPriority: [string, AccountSigner][] = [
      ...readOnlyEntries,
      ...privateKeyEntries,
      ...keyringEntries,
      ...ledgerEntries,
    ]

    return Object.fromEntries(entriesByPriority)
  }
)

export const selectCurrentAccountSigner = createSelector(
  selectAccountSignersByAddress,
  selectCurrentAccount,
  (signingAccounts, selectedAccount) => signingAccounts[selectedAccount.address]
)
