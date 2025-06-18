import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { createBackgroundAsyncThunk } from "./utils"
import logger from "../lib/logger"

export type WalletConnectState = {
  pendingProposal: {
    id: number
    dappName: string
    dappUrl: string
    dappIcon: string
  } | null
  activeSessions: {
    topic: string
    dappName: string
    dappUrl: string
    dappIcon: string
  }[]
}

const initialState: WalletConnectState = {
  pendingProposal: null,
  activeSessions: []
}

const walletConnectSlice = createSlice({
  name: "walletConnect",
  initialState,
  reducers: {
    setPendingProposal: (
      state,
      action: PayloadAction<{
        id: number
        dappName: string
        dappUrl: string
        dappIcon: string
      }>
    ) => {
      state.pendingProposal = action.payload
    },
    clearPendingProposal: (state) => {
      state.pendingProposal = null
    },
    addActiveSession(
      state,
      action: PayloadAction<WalletConnectState["activeSessions"][0]>
    ) {
      state.activeSessions.push(action.payload)
    },
    removeActiveSession(state, action: PayloadAction<string>) {
      state.activeSessions = state.activeSessions.filter(
        session => session.topic !== action.payload
      )
    }
  }
})

export const {
  setPendingProposal,
  clearPendingProposal,
  addActiveSession,
  removeActiveSession
} = walletConnectSlice.actions

export const selectPendingProposal = (state: { walletConnect: WalletConnectState }) =>
  state.walletConnect.pendingProposal

export default walletConnectSlice.reducer

export const approveWalletConnectSession = createBackgroundAsyncThunk(
  "walletConnect/approveSession",
  async ({ proposalId, address }: { proposalId: number, address: string }) => {
    try {
      const { walletConnectService } = globalThis.main
      await walletConnectService.approveSession(proposalId, [address])
    } catch (error) {
      logger.error("Error approving WalletConnect session:", error)
      throw error
    }
  }
)

export const rejectWalletConnectSession = createBackgroundAsyncThunk(
  "walletConnect/rejectSession",
  async ({ proposalId }: { proposalId: number }) => {
    try {
      const { walletConnectService } = globalThis.main
      await walletConnectService.rejectSession(proposalId)
    } catch (error) {
      logger.error("Error rejecting WalletConnect session:", error)
      throw error
    }
  }
)

export const pairWalletConnectUri = createBackgroundAsyncThunk(
  "walletConnect/pairUri",
  async ({ uri }: { uri: string }, { extra: { main } }) => {
    await main.walletConnectService.walletKit?.core.pairing.pair({ uri })
  }
) 