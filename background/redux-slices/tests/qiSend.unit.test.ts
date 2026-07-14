import reducer, {
  emitter,
  rejectDappQiTransaction,
  resetManualQiSendState,
  sendDappQiTransaction,
  setQiDappSendRequest,
} from "../qiSend"
import { NormalizedQiSendToOutputsRequest } from "../../services/transactions/types"
import { allAliases } from "../utils"

const dappRequest: NormalizedQiSendToOutputsRequest = {
  outputs: [
    {
      address: "0x0080000000000000000000000000000000000000",
      denomination: 1,
    },
  ],
  amountQit: "1000",
  chainId: "15000",
  zone: "0x00",
  account: 0,
  maxFeeQit: "100",
  origin: "https://app.test",
  requestId: "qi-send-1",
}

describe("Qi Send Redux Slice", () => {
  it("preserves pending dapp requests when resetting manual send state", () => {
    const stateWithDappRequest = reducer(
      undefined,
      setQiDappSendRequest(dappRequest)
    )

    const nextState = reducer(
      {
        ...stateWithDappRequest,
        amount: "1",
        receiverPaymentCode: "receiver",
        channelExists: true,
        isSending: true,
      },
      resetManualQiSendState()
    )

    expect(nextState.dappRequest).toEqual(dappRequest)
    expect(nextState.amount).toBe("")
    expect(nextState.receiverPaymentCode).toBe("")
    expect(nextState.channelExists).toBe(false)
    expect(nextState.isSending).toBe(false)
  })

  it("does not reject the provider request when the confirmed send is broadcasting", async () => {
    const isSendingPreparedDappQiSend = jest.fn().mockReturnValue(true)
    ;(globalThis as any).main = {
      transactionService: { isSendingPreparedDappQiSend },
    }
    const rejected = jest.fn()
    emitter.on("dappSendTransactionRejected", rejected)
    const state = {
      qiSend: {
        ...reducer(undefined, { type: "init" }),
        isSending: true,
        dappRequest,
      },
    }
    const dispatch = jest.fn()
    const getState = () => state

    try {
      const sendThunk = allAliases[sendDappQiTransaction.typePrefix]({
        type: sendDappQiTransaction.typePrefix,
        payload: undefined,
      })
      await sendThunk(dispatch, getState, undefined)
      const rejectThunk = allAliases[rejectDappQiTransaction.typePrefix]({
        type: rejectDappQiTransaction.typePrefix,
        payload: { requestId: dappRequest.requestId },
      })
      await rejectThunk(dispatch, getState, undefined)
      expect(rejected).not.toHaveBeenCalled()
      expect(isSendingPreparedDappQiSend).toHaveBeenCalledTimes(2)
    } finally {
      emitter.off("dappSendTransactionRejected", rejected)
    }
  })
})
