import { createSelector } from "@reduxjs/toolkit"
import { RootState } from ".."
import {
  DEFAULT_NETWORKS_BY_CHAIN_ID,
  TEST_NETWORK_BY_CHAIN_ID,
} from "../../constants"
import { EVMNetwork, EVMTestNetwork } from "../../networks"

// Adds chainID to each NFT for convenience in frontend
// eslint-disable-next-line import/prefer-default-export
export const selectEVMNetworks = createSelector(
  (state: RootState) => state.networks.evmNetworks,
  (evmNetworks): EVMNetwork[] => {
    if (!evmNetworks) return []
    return Object.values(evmNetworks)
  }
)

export const selectTestNetworksWithAvailabilityFlag = createSelector(
  (state: RootState) => state.networks.testNetworksWithAvailabilityFlag,
  (testNetworks): EVMTestNetwork[] => {
    if (!testNetworks) return []
    return Object.values(testNetworks)
  }
)

export const selectProductionEVMNetworks = createSelector(
  selectEVMNetworks,
  (evmNetworks) =>
    evmNetworks.filter(
      (network) => !TEST_NETWORK_BY_CHAIN_ID.has(network.chainID)
    )
)

export const selectCustomNetworks = createSelector(
  selectEVMNetworks,
  (evmNetworks) =>
    evmNetworks.filter(
      (network) => !DEFAULT_NETWORKS_BY_CHAIN_ID.has(network.chainID)
    )
)
