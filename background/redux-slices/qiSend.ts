import { createSlice } from "@reduxjs/toolkit"
import { AccountTotal } from "./selectors"
import { createBackgroundAsyncThunk } from "./utils"
import { RootState } from "./index"
import { UtxoAccountData } from "./accounts"

export type QiSendState = {
  senderQiAccount: UtxoAccountData | null
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
    setQiSendAcc: (
      immerState,
      { payload }: { payload: UtxoAccountData | null }
    ) => {
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
  async (_, { getState }) => {
    const { qiSend } = getState() as RootState

    const {
      amount,
      senderQuaiAccount,
      senderQiAccount,
      receiverPaymentCode,
      tips,
    } = qiSend

    const { address: quaiAddress } = senderQuaiAccount as AccountTotal
    const { paymentCode: senderPaymentCode } =
      senderQiAccount as UtxoAccountData

    const parsedAmount = BigInt(Number(amount) * 1000) // FIXME parseQi(amount)
    const maxPriorityFeePerGas = tips !== "" ? BigInt(tips) : null

    main.transactionService.sendQiTransaction(
      parsedAmount,
      quaiAddress,
      senderPaymentCode,
      receiverPaymentCode,
      maxPriorityFeePerGas
    )
  }
)
