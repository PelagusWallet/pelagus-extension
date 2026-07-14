# Quainance P2P Qi dapp integration

This branch exposes Pelagus's existing Qi receive-address reservation flow to
the Quainance P2P Qi frontend backed by the `p2p-qi` relay:

- `qi_getReceiveAddresses`
- `qi_commitReceiveAddressReservation`
- `qi_releaseReceiveAddressReservation`
- `qi_sendToOutputs`

The reservation changes are intentionally narrow. Both allocation and release
use explicit Pelagus confirmation windows. They do not change the keyring,
encrypted vault, wallet import, seed recovery, Qi change selection, mining
addresses, manual Qi sends, aggregation, or conversion.

## Confirmed allocation flow

`qi_getReceiveAddresses` does not silently expose or derive addresses. Pelagus
shows the requesting origin, reservation id, address count, zone, account, and
the four-address recovery-capacity warning. It binds the pending request to the
trusted provider origin, selected account, and selected network, then
revalidates all three immediately before allocation. Closing or rejecting the
popup leaves the wallet and reservation database unchanged.

A successful response includes `addressCapacity` and
`remainingAddressCapacity`. The latter is the number of still-unused historical
reservation slots left across every origin after the allocation.

## Confirmed release flow

For a trade that completed, the dapp requests release with `reason: "terminal"`.
For an accepted fill whose counterparty disappeared before a trade was created,
the dapp first stores the owner's signed timeout with its relay, then requests
release with `reason: "accepted-fill-timeout"`.

In both cases Pelagus:

1. overwrites dapp-supplied origin, owner, and chain context with the trusted
   provider origin and the currently permitted account/network;
2. validates the exact origin-bound committed reservation before opening the
   popup;
3. shows the origin, reservation id, address count, zone, account, and reason;
4. revalidates the selected account, origin network, and live permission when
   the user confirms;
5. re-reads the reservation under the existing allocation lock and records an
   idempotent release; and
6. returns `reservationId`, `status: "released"`, `releasedAt`,
   `alreadyReleased`, and `reason`.

Closing the popup or choosing **Keep addresses** rejects only that request and
does not mutate the reservation.

## Address nonreuse and limits

Reservation rows remain in the existing version 5 transactions database.
Every address in every historical reservation row, including expired and
released rows, is excluded from future dapp reservations in that browser
profile. All still-unused historical reservation addresses count against the
existing four-address recovery-gap budget, so allocation fails closed rather
than deriving past it. A connected origin cannot consume that budget without
the wallet user's explicit confirmation.

This is profile-local state. No keystore format was changed, so reservation
history does not survive IndexedDB deletion, extension reinstall, profile
reset, rollback to an older profile, or seed-only restoration. Use a fresh
wallet and browser profile dedicated to Quainance P2P Qi. If extension storage is lost,
retire that seed from future p2p reservations instead of assuming the wallet
can reconstruct retired unused addresses.

This implementation should not be described as general unattended-custody
recovery. Solving cross-profile or seed-only recovery requires a separate
keyring design and audit.
