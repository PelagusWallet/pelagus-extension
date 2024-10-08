import { createSlice } from "@reduxjs/toolkit"
import { AccountTotal } from "./selectors"
import { QiWallet } from "../services/keyring/types"
import { createBackgroundAsyncThunk } from "./utils"
import { RootState } from "./index"
import logger from "../lib/logger"

export type QiSendState = {
  senderQiAccount: QiWallet | null
  senderQuaiAccount: AccountTotal | null
  receiverPaymentCode: string
  amount: string
  tips: string
}

const initialState: QiSendState = {
  senderQiAccount: null,
  receiverPaymentCode: "",
  amount: "",
  senderQuaiAccount: null,
  tips: "",
}

const qiSendSlice = createSlice({
  name: "qiSend",
  initialState,
  reducers: {
    setQiSendAmount: (immerState, { payload }: { payload: string }) => {
      immerState.amount = payload
    },
    setQiSendTips: (immerState, { payload }: { payload: string }) => {
      immerState.tips = payload
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
    setQiSendAcc: (immerState, { payload }: { payload: QiWallet | null }) => {
      immerState.senderQiAccount = payload
    },
    resetQiSendSlice: (immerState) => {
      immerState.senderQiAccount = null
      immerState.senderQuaiAccount = null
      immerState.amount = ""
      immerState.receiverPaymentCode = ""
      immerState.tips = ""
    },
  },
})

export const {
  setQiSendQuaiAcc,
  setQiSendAcc,
  setQiSendAmount,
  setQiSendReceiverPaymentCode,
  setQiSendTips,
  resetQiSendSlice,
} = qiSendSlice.actions

export default qiSendSlice.reducer

export const sendQiTransaction = createBackgroundAsyncThunk(
  "qiSend/sendQiTransaction",
  async (_, { getState, rejectWithValue }) => {
    const { qiSend } = getState() as RootState

    const {
      amount,
      senderQuaiAccount,
      senderQiAccount,
      receiverPaymentCode,
      tips,
    } = qiSend

    try {
      const { address: quaiAddress } = senderQuaiAccount as AccountTotal
      const { paymentCode: senderPaymentCode } = senderQiAccount as QiWallet

      const parsedAmount = BigInt(amount) // FIXME parseQi(amount)
      const maxPriorityFeePerGas = tips !== "" ? BigInt(tips) : null

      await main.transactionService.sendQiTransaction(
        parsedAmount,
        quaiAddress,
        senderPaymentCode,
        receiverPaymentCode,
        maxPriorityFeePerGas
      )
    } catch (error) {
      logger.error(error)
      return rejectWithValue(error)
    }
  }
)