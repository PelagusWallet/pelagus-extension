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
  dappSendTransactionResponse: { requestId: string; txHash: string }
  dappSendTransactionRejected: { requestId: string; message?: string }
}

export const emitter = new Emittery<Events>()

const errorMessageFromUnknown = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message?: unknown }
    if (typeof message === "string" && message) return message
  }
  return fallback
}

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
      // The dapp confirmation UI reads dappRequest directly, so this must NOT
      // touch the manual send flow's fields (amount, receiverPaymentCode,
      // channelExists) or its in-flight guard (isSending) — doing so would
      // corrupt a manual send that happens to be open in another window.
      immerState.dappRequest = payload
    },
    clearQiDappRequest: (immerState) => {
      immerState.dappRequest = null
    },
    resetManualQiSendState: (immerState) => {
      immerState.senderQiAccount = null
      immerState.senderQuaiAccount = null
      immerState.amount = ""
      immerState.receiverPaymentCode = ""
      immerState.channelExists = false
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
  clearQiDappRequest,
  resetManualQiSendState,
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

      dispatch(resetManualQiSendState())
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
    const request = qiSend.dappRequest
    if (!request) {
      // Nothing pending to settle; surface the error to the UI only.
      return { error: { message: "No pending Qi dapp transaction" } }
    }

    const requestId = request.requestId ?? ""
    if (qiSend.isSending) {
      if (main.transactionService.isSendingPreparedDappQiSend()) {
        // The confirmed request already owns the prepared-send broadcast.
        // A remounted confirmation surface must not settle that live provider
        // request as rejected while the node outcome is still pending.
        return { error: { message: "Transaction broadcast is still in progress" } }
      }
      // Another send (manual or dapp) owns the wallet. Settle the dapp promise
      // and release the in-flight slot instead of returning silently — leaving
      // it pending would hang the dapp and block every future Qi send as "busy".
      // Do NOT touch isSending here: it belongs to the send already running.
      const message = "Transaction already in progress"
      await emitter.emit("dappSendTransactionRejected", { requestId, message })
      return { error: { message } }
    }

    dispatch(setQiSending(true))
    try {
      const txHash = await main.transactionService.sendQiToOutputs(request)
      await emitter.emit("dappSendTransactionResponse", { requestId, txHash })
      dispatch(clearQiDappRequest())
      dispatch(setQiSending(false))
      return { txHash }
    } catch (error: unknown) {
      // Settle the dapp promise with the REAL error message (not the generic
      // "rejected") and release the in-flight slot. The confirmation UI has no
      // reachable retry affordance, so leaving the request pending would hang
      // the dapp and block every future Qi send as "busy".
      const message = errorMessageFromUnknown(
        error,
        "Failed to send Qi transaction"
      )
      await emitter.emit("dappSendTransactionRejected", { requestId, message })
      dispatch(setQiSending(false))
      return { error: { message } }
    }
  }
)

export const rejectDappQiTransaction = createBackgroundAsyncThunk(
  "qiSend/rejectDappQiTransaction",
  async (args: { requestId?: string } | undefined, { getState, dispatch }) => {
    const { qiSend } = getState() as RootState
    // The UI captures the request id before it starts closing. Do not use a
    // later state value for the provider response: a close event must only
    // settle the exact dapp request this popup was created for.
    const requestId = args?.requestId ?? qiSend.dappRequest?.requestId
    if (!requestId) return
    if (main.transactionService.isSendingPreparedDappQiSend()) {
      // Closing or remounting the popup cannot turn an in-flight broadcast into
      // a rejection. The send path remains the sole owner of provider settlement.
      return
    }
    await emitter.emit("dappSendTransactionRejected", {
      requestId,
    })
    if (qiSend.dappRequest?.requestId === requestId) {
      dispatch(clearQiDappRequest())
    }
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
