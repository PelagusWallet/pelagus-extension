import { createSelector, OutputSelector } from "@reduxjs/toolkit"
import { RootState } from ".."
import {
  Keyring,
  PrivateKey,
  SignerImportSource,
} from "../../services/keyring/types"
import { HexString } from "../../types"

export const selectKeyringStatus = createSelector(
  (state: RootState) => state.keyrings.status,
  (status) => status
)

// FIXME temp fix
export const selectKeyringNextPage = createSelector(
  (state: RootState) => state.keyrings.nextPage,
  (nextPage) => nextPage
)

export const selectKeyringByAddress = (
  address: string
): OutputSelector<
  RootState,
  Keyring | undefined,
  (res: Keyring[]) => Keyring | undefined
> =>
  createSelector(
    [(state: RootState) => state.keyrings.keyrings],
    (keyrings) => {
      return keyrings.find((keyring) => keyring.addresses.includes(address))
    }
  )

export const selectKeyringsByAddresses = createSelector(
  (state: RootState) => state.keyrings.keyrings,
  (
    keyrings
  ): {
    [address: HexString]: Keyring
  } =>
    Object.fromEntries(
      keyrings.flatMap((keyring) =>
        keyring.addresses.map((address) => [address, keyring])
      )
    )
)

export const selectPrivateKeyWalletsByAddress = createSelector(
  (state: RootState) => state.keyrings.privateKeys,
  (privateKeys): { [address: HexString]: PrivateKey } =>
    !privateKeys
      ? {}
      : Object.fromEntries(
          privateKeys.map((wallet) => [wallet.addresses[0], wallet])
        )
)

export const selectSourcesByAddress = createSelector(
  (state: RootState) => state.keyrings.keyrings,
  (state: RootState) => state.keyrings.keyringMetadata,
  (
    keyrings,
    keyringMetadata
  ): {
    [address: HexString]: SignerImportSource
  } =>
    Object.fromEntries(
      keyrings
        // get rid of "Loading" keyrings
        .filter((keyring) => !!keyring.id)
        .flatMap((keyring) =>
          keyring.addresses.map((address) => [
            address,
            // Guaranteed to exist by the filter above
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            keyringMetadata[keyring.id!]?.source,
          ])
        )
    )
)

export const selectIsWalletExists = createSelector(
  (state: RootState) => state.keyrings.keyrings,
  (keyrings) => !!(keyrings && keyrings.length)
)
