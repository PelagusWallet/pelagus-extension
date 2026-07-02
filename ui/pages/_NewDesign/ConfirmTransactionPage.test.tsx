import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ConfirmTransactionPage from "./ConfirmTransactionPage"

const mockDispatch = jest.fn()
const mockSendQiTransaction = jest.fn(() => ({ type: "qiSend/send" }))
const mockHistoryPush = jest.fn()

type MockState = {
  qiSend: {
    senderQuaiAccount: { balance: string }
    channelExists: boolean
    dappRequest: {
      outputs: Array<{ address: string; denomination: number }>
      amountQit: string
      zone: string
      account: number
      origin: string
      requestId: string
    }
  }
}

let mockState: MockState

jest.mock("../../hooks", () => ({
  useBackgroundDispatch: () => mockDispatch,
  useBackgroundSelector: (selector: (state: MockState) => unknown) =>
    selector(mockState),
}))

jest.mock("@pelagus/pelagus-background/redux-slices/selectors", () => ({
  selectCurrentNetwork: () => ({
    blockExplorerURL: "https://explorer.test",
  }),
}))

jest.mock("@pelagus/pelagus-background/redux-slices/qiSend", () => ({
  sendQiTransaction: () => mockSendQiTransaction(),
}))

jest.mock("react-router-dom", () => ({
  useHistory: () => ({ push: mockHistoryPush }),
}))

jest.mock(
  "../../components/_NewDesign/ConfirmTransaction/ConfirmTransaction",
  () =>
    function ConfirmTransaction() {
      return <div data-testid="manual-confirmation">Manual confirmation</div>
    }
)

jest.mock(
  "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons",
  () =>
    function SharedActionButtons({
      title,
      onClick,
    }: {
      title: { confirmTitle: string; cancelTitle: string }
      onClick: { onConfirm: () => void; onCancel: () => void }
    }) {
      return (
        <div>
          <button type="button" onClick={onClick.onCancel}>
            {title.cancelTitle}
          </button>
          <button type="button" onClick={onClick.onConfirm}>
            {title.confirmTitle}
          </button>
        </div>
      )
    }
)

jest.mock(
  "../../components/AccountsNotificationPanel/AccountsNotificationPanel",
  () =>
    function AccountsNotificationPanel() {
      return null
    }
)

jest.mock(
  "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader",
  () =>
    function SharedGoBackPageHeader() {
      return null
    }
)

jest.mock(
  "../../components/Shared/SharedConfirmationModal",
  () =>
    function SharedConfirmationModal() {
      return null
    }
)

describe("ConfirmTransactionPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDispatch.mockResolvedValue({ txHash: "0xabc" })
    mockState = {
      qiSend: {
        senderQuaiAccount: { balance: "1 QUAI" },
        channelExists: false,
        dappRequest: {
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
        },
      },
    }
  })

  it("keeps the manual confirmation flow even when a dapp request is pending", async () => {
    render(<ConfirmTransactionPage />)

    expect(screen.getByTestId("manual-confirmation")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Send" }))

    expect(mockSendQiTransaction).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledWith({ type: "qiSend/send" })
  })
})
