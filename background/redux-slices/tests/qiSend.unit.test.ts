import reducer, {
  resetManualQiSendState,
  setQiDappSendRequest,
} from "../qiSend"
import { NormalizedQiSendToOutputsRequest } from "../../services/transactions/types"

const dappRequest: NormalizedQiSendToOutputsRequest = {
  outputs: [
    {
      address: "0x0080000000000000000000000000000000000000",
      denomination: 1,
    },
  ],
  amountQit: "1000",
  zone: "0x00",
  account: 0,
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
})
