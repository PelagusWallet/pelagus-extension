import { createSlice } from "@reduxjs/toolkit"
import { createBackgroundAsyncThunk } from "./utils"
import { Block, AnyEVMBlock } from "../networks"
import { NetworkInterface } from "../constants/networks/networkTypes"
import { LocalNodeNetworkStatusEventTypes } from "../services/provider-factory/events"
import { 
  HTTPS_RPC_URL, 
  ORCHARD_HTTPS_RPC_URL 
} from "../constants/networks"

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
  customRPCs: {
    [chainID: string]: {
      httpRpcUrl: string
      wsRpcUrl: string
    }
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
  customRPCs: {},
}

// Async thunks for custom RPC operations
export const setCustomRPCWithRefresh = createBackgroundAsyncThunk(
  "networks/setCustomRPCWithRefresh",
  async (
    { chainID, httpRpcUrl, wsRpcUrl }: { chainID: number; httpRpcUrl: string; wsRpcUrl: string },
    { extra: { main }, dispatch }
  ) => {
    // Update Redux state
    dispatch(setCustomRPC({ chainID, httpRpcUrl, wsRpcUrl }))
    
    // Refresh providers
    const chainIdString = String(chainID)
    if (main.providerFactoryService) {
      main.providerFactoryService.refreshProvidersForNetwork(chainIdString)
    }
    
    // Refresh ChainService providers
    if (main.chainService) {
      main.chainService.refreshProviders()
    }
    
    return { chainID, httpRpcUrl, wsRpcUrl }
  }
)

export const resetToDefaultRPCWithRefresh = createBackgroundAsyncThunk(
  "networks/resetToDefaultRPCWithRefresh",
  async (chainID: number, { extra: { main }, dispatch }) => {
    // Update Redux state
    dispatch(resetToDefaultRPC(chainID))
    
    // Refresh providers
    const chainIdString = String(chainID)
    if (main.providerFactoryService) {
      main.providerFactoryService.refreshProvidersForNetwork(chainIdString)
    }
    
    // Refresh ChainService providers
    if (main.chainService) {
      main.chainService.refreshProviders()
    }
    
    return { chainID }
  }
)

const networksSlice = createSlice({
  name: "networks",
  initialState,
  reducers: {
    blockSeen: (
      immerState,
      { payload: blockPayload }: { payload: AnyEVMBlock }
    ) => {
      const block = blockPayload as Block

      if (!(block.network.chainID in immerState.blockInfo)) {
        const blockHeight = block.blockHeight || null
        const baseFeePerGas = block.baseFeePerGas || null

        immerState.blockInfo[block.network.chainID] = {
          blockHeight,
          baseFeePerGas,
        }
      } else if (
        block.blockHeight >
        (immerState.blockInfo[block.network.chainID].blockHeight || 0)
      ) {
        const blockHeight = block.blockHeight || null
        const baseFeePerGas = block.baseFeePerGas || null

        if (blockHeight !== null) {
          immerState.blockInfo[block.network.chainID].blockHeight = blockHeight
        }
        if (baseFeePerGas !== null) {
          immerState.blockInfo[block.network.chainID].baseFeePerGas =
            baseFeePerGas
        }
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
      const { isDisabled, localNodeNetworkChainId } = payload

      const network = immerState.quaiNetworks[localNodeNetworkChainId]
      if (network) {
        immerState.quaiNetworks[localNodeNetworkChainId] = {
          ...network,
          isDisabled,
        }
      }
    },
    setCustomRPC: (
      immerState,
      { payload }: { payload: { chainID: number; httpRpcUrl: string; wsRpcUrl: string } }
    ) => {
      const { chainID, httpRpcUrl, wsRpcUrl } = payload
      
      // Ensure customRPCs exists (for backward compatibility with existing state)
      if (!immerState.customRPCs) {
        immerState.customRPCs = {}
      }
      
      immerState.customRPCs[chainID] = {
        httpRpcUrl,
        wsRpcUrl
      }
      
      // Update the network's RPC URLs if it exists (convert chainID to string for network lookup)
      const chainIdString = String(chainID)
      if (immerState.quaiNetworks[chainIdString]) {
        immerState.quaiNetworks[chainIdString] = {
          ...immerState.quaiNetworks[chainIdString],
          jsonRpcUrls: [httpRpcUrl],
          webSocketRpcUrls: [wsRpcUrl]
        }
      }
    },
    resetToDefaultRPC: (
      immerState,
      { payload: chainID }: { payload: number }
    ) => {
      // Ensure customRPCs exists (for backward compatibility with existing state)
      if (!immerState.customRPCs) {
        immerState.customRPCs = {}
      }
      
      delete immerState.customRPCs[chainID]
      
      // Reset to default RPC based on chainID (convert chainID to string for network lookup)
      const chainIdString = String(chainID)
      if (immerState.quaiNetworks[chainIdString]) {
        let defaultHttpRPC = ""
        let defaultWsRPC = ""
        switch (chainID) {
          case 9:
            defaultHttpRPC = HTTPS_RPC_URL
            defaultWsRPC = HTTPS_RPC_URL.replace('https://', 'wss://')
            break
          case 15000:
            defaultHttpRPC = ORCHARD_HTTPS_RPC_URL
            defaultWsRPC = ORCHARD_HTTPS_RPC_URL.replace('https://', 'wss://')
            break
          case 1337:
            defaultHttpRPC = "http://localhost:8546"
            defaultWsRPC = "ws://localhost:8546"
            break
          default:
            defaultHttpRPC = HTTPS_RPC_URL
            defaultWsRPC = HTTPS_RPC_URL.replace('https://', 'wss://')
        }
        
        immerState.quaiNetworks[chainIdString] = {
          ...immerState.quaiNetworks[chainIdString],
          jsonRpcUrls: [defaultHttpRPC],
          webSocketRpcUrls: [defaultWsRPC]
        }
      }
    },
  },
})

export const { blockSeen, setEVMNetworks, updateNetwork, setCustomRPC, resetToDefaultRPC } =
  networksSlice.actions

export default networksSlice.reducer
