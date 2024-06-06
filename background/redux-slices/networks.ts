import { createSlice } from "@reduxjs/toolkit"
import type { RootState } from "."
import { QUAI_NETWORK } from "../constants"
import {
  EIP1559Block,
  AnyEVMBlock,
  EVMNetwork,
  EVMTestNetwork,
} from "../networks"
import { removeChainBalances } from "./accounts"
import { selectCurrentNetwork } from "./selectors/uiSelectors"
import { setSelectedNetwork } from "./ui"
import { createBackgroundAsyncThunk } from "./utils"

type NetworkState = {
  blockHeight: number | null
  baseFeePerGas: bigint | null
}

export type NetworksState = {
  evmNetworks: {
    [chainID: string]: EVMNetwork
  }
  testNetworksWithAvailabilityFlag: {
    [chainID: string]: EVMTestNetwork
  }
  blockInfo: {
    [chainID: string]: NetworkState
  }
}

export const initialState: NetworksState = {
  evmNetworks: {},
  testNetworksWithAvailabilityFlag: {},
  blockInfo: {
    "1": {
      blockHeight: null,
      baseFeePerGas: null,
    },
  },
}

const networksSlice = createSlice({
  name: "networks",
  initialState,
  reducers: {
    blockSeen: (
      immerState,
      { payload: blockPayload }: { payload: AnyEVMBlock }
    ) => {
      const block = blockPayload as EIP1559Block

      if (!(block.network.chainID in immerState.blockInfo)) {
        immerState.blockInfo[block.network.chainID] = {
          blockHeight: block.blockHeight,
          baseFeePerGas: block?.baseFeePerGas ?? null,
        }
      } else if (
        block.blockHeight >
        (immerState.blockInfo[block.network.chainID].blockHeight || 0)
      ) {
        immerState.blockInfo[block.network.chainID].blockHeight =
          block.blockHeight
        immerState.blockInfo[block.network.chainID].baseFeePerGas =
          block?.baseFeePerGas ?? null
      }
    },
    /**
     * Receives all supported networks as the payload
     */
    setEVMNetworks: (immerState, { payload }: { payload: EVMNetwork[] }) => {
      const chainIds = payload.map((network) => network.chainID)

      payload.forEach((network) => {
        immerState.evmNetworks[network.chainID] = network
      })

      // Remove payload missing networks from state
      Object.keys(immerState.evmNetworks).forEach((chainID) => {
        if (!chainIds.includes(chainID)) {
          delete immerState.evmNetworks[chainID]
          delete immerState.blockInfo[chainID]
        }
      })
    },

    setTestNetworksWithAvailabilityFlag: (
      immerState,
      { payload }: { payload: EVMTestNetwork[] }
    ) => {
      const chainIds = payload.map((network) => network.chainID)

      payload.forEach((network) => {
        immerState.testNetworksWithAvailabilityFlag[network.chainID] = network
      })

      // Remove payload missing networks from state
      Object.keys(immerState.testNetworksWithAvailabilityFlag).forEach(
        (chainID) => {
          if (!chainIds.includes(chainID)) {
            delete immerState.testNetworksWithAvailabilityFlag[chainID]
            delete immerState.blockInfo[chainID]
          }
        }
      )
    },
  },
})

export const {
  blockSeen,
  setEVMNetworks,
  setTestNetworksWithAvailabilityFlag,
} = networksSlice.actions

export default networksSlice.reducer

export const removeCustomChain = createBackgroundAsyncThunk(
  "networks/removeCustomChain",
  async (chainID: string, { getState, dispatch, extra: { main } }) => {
    const store = getState() as RootState
    const currentNetwork = selectCurrentNetwork(store)

    if (currentNetwork.chainID === chainID) {
      await dispatch(setSelectedNetwork(QUAI_NETWORK))
    }
    await dispatch(removeChainBalances(chainID))

    return main.removeEVMNetwork(chainID)
  }
)
