import { createSelector } from "@reduxjs/toolkit"
import { RootState } from ".."
import { NetworkInterface } from "../../constants/networks/networkTypes"

export const selectQuaiNetworks = createSelector(
  (state: RootState) => state.networks.quaiNetworks,
  (quaiNetworks): NetworkInterface[] =>
    quaiNetworks ? Object.values(quaiNetworks) : []
)
