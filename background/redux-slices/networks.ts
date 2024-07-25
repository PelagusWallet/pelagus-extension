import { createSlice } from "@reduxjs/toolkit"
import { EIP1559Block, AnyEVMBlock } from "../networks"
import { NetworkInterface } from "../constants/networks/networkTypes"
import { LocalNodeNetworkStatusEventTypes } from "../services/provider-factory/events"

type NetworkState = {
  blockHeight: number | null
  baseFeePerGas: bigint | null
}

export type NetworksState = {
  quaiNetworks: {
    [chainID: string]: NetworkInterface
  }
  blockInfo: {
    [chainID: string]: NetworkState
  }
}

export const initialState: NetworksState = {
  quaiNetworks: {},
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
    setEVMNetworks: (
      immerState,
      { payload }: { payload: NetworkInterface[] }
    ) => {
      const chainIds = payload.map((network) => network.chainID)

      payload.forEach((network) => {
        immerState.quaiNetworks[network.chainID] = network
      })

      // Remove payload missing networks from state
      Object.keys(immerState.quaiNetworks).forEach((chainID) => {
        if (!chainIds.includes(chainID)) {
          delete immerState.quaiNetworks[chainID]
          delete immerState.blockInfo[chainID]
        }
      })
    },
    updateNetwork: (
      immerState,
      { payload }: { payload: LocalNodeNetworkStatusEventTypes }
    ) => {
      const { status, localNodeNetworkChainId } = payload

      const network = immerState.quaiNetworks[localNodeNetworkChainId]
      if (network) {
        immerState.quaiNetworks[localNodeNetworkChainId] = {
          ...network,
          isDisabled: status,
        }
      }
    },
  },
})

export const { blockSeen, setEVMNetworks, updateNetwork } =
  networksSlice.actions

export default networksSlice.reducer
