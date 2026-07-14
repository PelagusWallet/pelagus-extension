import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import DappQiConfirmTransactionPage from "./DappQiConfirmTransactionPage"

const mockDispatch = jest.fn()
const mockRejectDappQiTransaction = jest.fn((payload) => ({
  type: "qiSend/rejectDappQiTransaction",
  payload,
}))
const mockSendDappQiTransaction = jest.fn(() => ({
  type: "qiSend/sendDappQiTransaction",
}))
const mockHistoryPush = jest.fn()
const mockWindowClose = jest.fn()

type MockState = {
  qiSend: {
    dappRequest: {
      outputs: Array<{ address: string; denomination: number }>
      amountQit: string
      chainId: string
      zone: string
      account: number
      maxFeeQit: string
      validUntil?: number
      origin: string
      requestId: string
      label?: string
      tradeHash?: string
      prepared?: {
        preparedId: string
        unsignedSerialized: string
        digest: string
        requestFingerprint: string
        inputs: Array<{
          txhash: string
          index: number
          address: string
          denomination: number
          lock?: number
          valueQit: string
          chainID: string
          derivationPath: string
        }>
        outputs: Array<{ address: string; denomination: number }>
        changeOutputs: Array<{ address: string; denomination: number }>
        amountQit: string
        feeQit: string
        maxFeeQit: string
        inputTotalQit: string
        totalDebitQit: string
        sourceAccount: number
        sourcePaymentCode: string
        preparedAt: number
        expiresAt: number
      }
    } | null
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
    chainID: "15000",
    baseAsset: { name: "Orchard Testnet" },
  }),
}))

jest.mock("@pelagus/pelagus-background/redux-slices/qiSend", () => ({
  rejectDappQiTransaction: (payload: { requestId: string }) =>
    mockRejectDappQiTransaction(payload),
  sendDappQiTransaction: () => mockSendDappQiTransaction(),
}))

jest.mock("react-router-dom", () => ({
  useHistory: () => ({ push: mockHistoryPush }),
}))

jest.mock(
  "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader",
  () =>
    function SharedGoBackPageHeader({
      onBack,
      preventNavigation,
    }: {
      onBack?: () => void
      preventNavigation?: boolean
    }) {
      return (
        <button
          type="button"
          data-prevent-navigation={String(preventNavigation)}
          onClick={onBack}
        >
          Header Back
        </button>
      )
    }
)

jest.mock(
  "../../components/Shared/_newDeisgn/actionButtons/SharedActionButtons",
  () =>
    function SharedActionButtons({
      title,
      onClick,
      isConfirmDisabled,
    }: {
      title: { confirmTitle: string; cancelTitle: string }
      onClick: { onConfirm: () => void; onCancel: () => void }
      isConfirmDisabled?: boolean
    }) {
      return (
        <div>
          <button type="button" onClick={onClick.onCancel}>
            {title.cancelTitle}
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={onClick.onConfirm}
          >
            {title.confirmTitle}
          </button>
        </div>
      )
    }
)

jest.mock(
  "../../components/Shared/SharedConfirmationModal",
  () =>
    function SharedConfirmationModal() {
      return null
    }
)

describe("DappQiConfirmTransactionPage", () => {
  const originalWindowClose = window.close

  beforeEach(() => {
    jest.clearAllMocks()
    mockDispatch.mockResolvedValue(undefined)
    Object.defineProperty(window, "close", {
      configurable: true,
      value: mockWindowClose,
    })
    const validUntil = Date.now() + 120_000
    mockState = {
      qiSend: {
        dappRequest: {
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
          validUntil,
          origin: "https://app.test",
          requestId: "qi-send-1",
          label: "Fund custody",
          tradeHash: "0xfeed00000000000000000000000000000000beef",
          prepared: {
            preparedId: "0xprepared",
            unsignedSerialized: "0xunsigned",
            digest: "0xdigest",
            requestFingerprint: "0xrequestfingerprint",
            inputs: [
              {
                txhash: "0xinput",
                index: 0,
                address: "0x0081000000000000000000000000000000000000",
                denomination: 2,
                lock: 7,
                valueQit: "2000",
                chainID: "15000",
                derivationPath: "BIP44:external:0",
              },
            ],
            outputs: [
              {
                address: "0x0080000000000000000000000000000000000000",
                denomination: 1,
              },
            ],
            changeOutputs: [
              {
                address: "0x0082000000000000000000000000000000000000",
                denomination: 0,
              },
            ],
            amountQit: "1000",
            feeQit: "10",
            maxFeeQit: "100",
            inputTotalQit: "2000",
            totalDebitQit: "1010",
            sourceAccount: 0,
            sourcePaymentCode: "QPPelagusSourcePaymentCode",
            preparedAt: Date.now(),
            expiresAt: validUntil,
          },
        },
      },
    }
  })

  afterAll(() => {
    Object.defineProperty(window, "close", {
      configurable: true,
      value: originalWindowClose,
    })
  })

  it("rejects the exact pending request before header Back closes the popup", async () => {
    let resolveDispatch: (() => void) | undefined
    mockDispatch.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDispatch = resolve
        })
    )

    render(<DappQiConfirmTransactionPage />)

    const headerBack = screen.getByRole("button", { name: "Header Back" })
    expect(headerBack).toHaveAttribute("data-prevent-navigation", "true")
    expect(screen.getByText("Orchard Testnet")).toBeInTheDocument()
    expect(screen.getByText("15000")).toBeInTheDocument()
    expect(screen.getByText("Exact wallet transaction")).toBeInTheDocument()
    expect(screen.getByText("Total wallet debit")).toBeInTheDocument()
    expect(screen.getByText("Network fee")).toBeInTheDocument()
    expect(screen.getByText("Site fee limit")).toBeInTheDocument()
    expect(screen.getByText("Wallet review expires")).toBeInTheDocument()
    expect(screen.getByText("Site funding deadline")).toBeInTheDocument()
    expect(
      screen.getByText(/will not sign or broadcast this transaction after/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText("0x0080000000000000000000000000000000000000")
    ).toBeInTheDocument()
    expect(screen.getByText("Wallet change")).toBeInTheDocument()
    expect(screen.getByText("Site-provided context")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Send / })).toBeEnabled()

    await userEvent.click(headerBack)
    await userEvent.click(screen.getByRole("button", { name: "Back" }))

    expect(mockRejectDappQiTransaction).toHaveBeenCalledTimes(1)
    expect(mockRejectDappQiTransaction).toHaveBeenCalledWith({
      requestId: "qi-send-1",
    })
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    expect(mockWindowClose).not.toHaveBeenCalled()

    resolveDispatch?.()

    await waitFor(() => {
      expect(mockWindowClose).toHaveBeenCalledTimes(1)
      expect(mockHistoryPush).toHaveBeenCalledWith("/")
    })
  })

  it("rejects the exact pending request when history navigation unmounts the popup", () => {
    const { unmount } = render(<DappQiConfirmTransactionPage />)

    unmount()

    expect(mockRejectDappQiTransaction).toHaveBeenCalledTimes(1)
    expect(mockRejectDappQiTransaction).toHaveBeenCalledWith({
      requestId: "qi-send-1",
    })
  })

  it("disables signing when the wallet has no exact prepared transaction", () => {
    if (mockState.qiSend.dappRequest) {
      delete mockState.qiSend.dappRequest.prepared
    }

    render(<DappQiConfirmTransactionPage />)

    expect(
      screen.getByText(/could not prepare an exact transaction/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Send / })).toBeDisabled()
  })

  it("disables an expired preparation and shows a recovery instruction", () => {
    if (mockState.qiSend.dappRequest?.prepared) {
      mockState.qiSend.dappRequest.prepared.expiresAt = Date.now() - 1
    }

    render(<DappQiConfirmTransactionPage />)

    expect(
      screen.getByText(/prepared transaction expired/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Send / })).toBeDisabled()
  })

  it("disables sending when the site deadline expires while the popup is open", () => {
    jest.useFakeTimers()
    const now = Date.now()
    if (mockState.qiSend.dappRequest?.prepared) {
      mockState.qiSend.dappRequest.validUntil = now + 1000
      mockState.qiSend.dappRequest.prepared.expiresAt = now + 1000
    }

    const { unmount } = render(<DappQiConfirmTransactionPage />)
    expect(screen.getByRole("button", { name: /Send / })).toBeEnabled()

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(
      screen.getByText(/site funding deadline has passed/i)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Send / })).toBeDisabled()

    unmount()
    jest.useRealTimers()
  })

  it("submits the exact pending request only once while broadcast is pending", () => {
    mockDispatch.mockImplementation(() => new Promise(() => undefined))
    render(<DappQiConfirmTransactionPage />)

    const send = screen.getByRole("button", { name: /Send / })
    fireEvent.click(send)
    fireEvent.click(send)

    expect(mockSendDappQiTransaction).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })
})
