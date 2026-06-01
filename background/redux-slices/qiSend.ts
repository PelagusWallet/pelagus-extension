import { createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { parseQi } from "quais"
import { AccountTotal } from "./selectors"
import { createBackgroundAsyncThunk } from "./utils"
import { RootState } from "./index"
import { UtxoAccountData } from "./accounts"
import { NormalizedQiSendToOutputsRequest } from "../services/transactions/types"

export type QiSendState = {
  senderQiAccount: UtxoAccountData | null
  senderQuaiAccount: AccountTotal | null
  receiverPaymentCode: string
  amount: string
  channelExists: boolean
  isSending: boolean
  dappRequest: NormalizedQiSendToOutputsRequest | null
}

const initialState: QiSendState = {
  senderQiAccount: null,
  receiverPaymentCode: "",
  amount: "",
  senderQuaiAccount: null,
  channelExists: false,
  isSending: false,
  dappRequest: null,
}

type Events = {
  dappSendTransactionResponse: { txHash: string }
  dappSendTransactionRejected: { message?: string }
}

export const emitter = new Emittery<Events>()

const qiSendSlice = createSlice({
  name: "qiSend",
  initialState,
  reducers: {
    setQiSendAmount: (immerState, { payload }: { payload: string }) => {
      immerState.amount = payload
    },
    setQiSendReceiverPaymentCode: (
      immerState,
      { payload }: { payload: string }
    ) => {
      immerState.receiverPaymentCode = payload
    },
    setQiSendQuaiAcc: (
      immerState,
      { payload }: { payload: AccountTotal | null }
    ) => {
      immerState.senderQuaiAccount = payload
    },
    setQiSendAcc: (
      immerState,
      { payload }: { payload: UtxoAccountData | null }
    ) => {
      immerState.senderQiAccount = payload
    },
    setQiChannelExists: (immerState, { payload }: { payload: boolean }) => {
      immerState.channelExists = payload
    },
    setQiSending: (immerState, { payload }: { payload: boolean }) => {
      immerState.isSending = payload
    },
    setQiDappSendRequest: (
      immerState,
      { payload }: { payload: NormalizedQiSendToOutputsRequest }
    ) => {
      immerState.dappRequest = payload
      immerState.amount = payload.amountQit
      immerState.receiverPaymentCode =
        payload.outputs.length === 1
          ? payload.outputs[0].address
          : `${payload.outputs.length} Qi outputs`
      immerState.channelExists = true
      immerState.isSending = false
    },
    resetQiSendSlice: (immerState) => {
      immerState.senderQiAccount = null
      immerState.senderQuaiAccount = null
      immerState.amount = ""
      immerState.receiverPaymentCode = ""
      immerState.channelExists = false
      immerState.isSending = false
      immerState.dappRequest = null
    },
  },
})

export const {
  setQiSendQuaiAcc,
  setQiSendAcc,
  setQiSendAmount,
  setQiSendReceiverPaymentCode,
  setQiChannelExists,
  setQiSending,
  setQiDappSendRequest,
  resetQiSendSlice,
} = qiSendSlice.actions

export default qiSendSlice.reducer

export const sendQiTransaction = createBackgroundAsyncThunk(
  "qiSend/sendQiTransaction",
  async (_, { getState, dispatch }) => {
    const { qiSend } = getState() as RootState

    // DEBUG: Log every thunk invocation with timestamp
    const invocationId = Date.now()
    console.log(`[sendQiTransaction] Thunk invoked at ${invocationId}, isSending: ${qiSend.isSending}`)

    // Prevent duplicate submissions
    if (qiSend.isSending) {
      console.log(`[sendQiTransaction] BLOCKED - Transaction already in progress (invocation ${invocationId})`)
      return { error: { message: "Transaction already in progress" } }
    }

    // Mark as sending immediately to prevent race conditions
    console.log(`[sendQiTransaction] Setting isSending=true (invocation ${invocationId})`)
    dispatch(setQiSending(true))

    const { amount, senderQuaiAccount, senderQiAccount, receiverPaymentCode } =
      qiSend

    const { address: quaiAddress = "" } = senderQuaiAccount || {}
    const { paymentCode: senderPaymentCode } =
      senderQiAccount as UtxoAccountData

    const parsedAmount = parseQi(amount)

    try {
      const txHash = await main.transactionService.sendQiTransaction(
        parsedAmount,
        quaiAddress,
        senderPaymentCode,
        receiverPaymentCode
      )

      dispatch(resetQiSendSlice())
      return { txHash }
    } catch (error: any) {
      console.log("error in sendQiTransaction", error)
      dispatch(setQiSending(false))
      return {
        error: {
          message: typeof error === 'string' ? error : error?.message
        }
      }
    }
  }
)

export const sendDappQiTransaction = createBackgroundAsyncThunk(
  "qiSend/sendDappQiTransaction",
  async (_, { getState, dispatch }) => {
    const { qiSend } = getState() as RootState
    if (!qiSend.dappRequest) {
      const message = "No pending Qi dapp transaction"
      await emitter.emit("dappSendTransactionRejected", { message })
      return { error: { message } }
    }
    if (qiSend.isSending) {
      const message = "Transaction already in progress"
      return { error: { message } }
    }

    dispatch(setQiSending(true))
    try {
      const txHash = await main.transactionService.sendQiToOutputs(
        qiSend.dappRequest
      )
      await emitter.emit("dappSendTransactionResponse", { txHash })
      dispatch(resetQiSendSlice())
      return { txHash }
    } catch (error: any) {
      const message = typeof error === "string" ? error : error?.message
      await emitter.emit("dappSendTransactionRejected", { message })
      dispatch(setQiSending(false))
      return { error: { message } }
    }
  }
)

export const rejectDappQiTransaction = createBackgroundAsyncThunk(
  "qiSend/rejectDappQiTransaction",
  async (_, { dispatch }) => {
    await emitter.emit("dappSendTransactionRejected", {
      message: "Qi transaction rejected",
    })
    dispatch(resetQiSendSlice())
  }
)

export const doesChannelExists = createBackgroundAsyncThunk(
  "qiSend/checkPaymentChannel",
  async (_, { getState, dispatch }) => {
    const { qiSend } = getState() as RootState

    const { senderQiAccount, receiverPaymentCode } = qiSend
    const { paymentCode: senderPaymentCode } =
      senderQiAccount as UtxoAccountData

    const channelExists =
      await main.transactionService.doesChannelExistForReceiver(
        senderPaymentCode,
        receiverPaymentCode
      )

    dispatch(setQiChannelExists(channelExists))

    return channelExists
  }
)
