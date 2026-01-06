import { createSlice } from "@reduxjs/toolkit"
import { parseQi } from "quais"
import { AccountTotal } from "./selectors"
import { createBackgroundAsyncThunk } from "./utils"
import { RootState } from "./index"
import { UtxoAccountData } from "./accounts"

export type QiSendState = {
  senderQiAccount: UtxoAccountData | null
  senderQuaiAccount: AccountTotal | null
  receiverPaymentCode: string
  amount: string
  channelExists: boolean
  isSending: boolean
}

const initialState: QiSendState = {
  senderQiAccount: null,
  receiverPaymentCode: "",
  amount: "",
  senderQuaiAccount: null,
  channelExists: false,
  isSending: false,
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
    resetQiSendSlice: (immerState) => {
      immerState.senderQiAccount = null
      immerState.senderQuaiAccount = null
      immerState.amount = ""
      immerState.receiverPaymentCode = ""
      immerState.channelExists = false
      immerState.isSending = false
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
