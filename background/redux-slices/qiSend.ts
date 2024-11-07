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
  minerTip: string
  channelExists: boolean
}

const initialState: QiSendState = {
  senderQiAccount: null,
  receiverPaymentCode: "",
  amount: "",
  senderQuaiAccount: null,
  minerTip: "",
  channelExists: false,
}

const qiSendSlice = createSlice({
  name: "qiSend",
  initialState,
  reducers: {
    setQiSendAmount: (immerState, { payload }: { payload: string }) => {
      immerState.amount = payload
    },
    setQiSendMinerTip: (immerState, { payload }: { payload: string }) => {
      immerState.minerTip = payload
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
    resetQiSendSlice: (immerState) => {
      immerState.senderQiAccount = null
      immerState.senderQuaiAccount = null
      immerState.amount = ""
      immerState.receiverPaymentCode = ""
      immerState.minerTip = ""
      immerState.channelExists = false
    },
  },
})

export const {
  setQiSendQuaiAcc,
  setQiSendAcc,
  setQiSendAmount,
  setQiSendReceiverPaymentCode,
  setQiSendMinerTip,
  setQiChannelExists,
  resetQiSendSlice,
} = qiSendSlice.actions

export default qiSendSlice.reducer

export const sendQiTransaction = createBackgroundAsyncThunk(
  "qiSend/sendQiTransaction",
  async (_, { getState, dispatch }) => {
    const { qiSend } = getState() as RootState

    const {
      amount,
      senderQuaiAccount,
      senderQiAccount,
      receiverPaymentCode,
      minerTip,
    } = qiSend

    const { address: quaiAddress = "" } = senderQuaiAccount || {}
    const { paymentCode: senderPaymentCode } =
      senderQiAccount as UtxoAccountData

    const parsedAmount = parseQi(amount)
    const minerTipBigInt = minerTip !== "" ? BigInt(minerTip) : null

    await main.transactionService.sendQiTransaction(
      parsedAmount,
      quaiAddress,
      senderPaymentCode,
      receiverPaymentCode,
      minerTipBigInt
    )

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
