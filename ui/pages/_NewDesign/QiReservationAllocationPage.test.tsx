import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import QiReservationAllocationPage from "./QiReservationAllocationPage"

const mockDispatch = jest.fn()
const mockConfirm = jest.fn((payload) => ({
  type: "qiReservation/confirmQiReservationAllocation",
  payload,
}))
const mockReject = jest.fn((payload) => ({
  type: "qiReservation/rejectQiReservationAllocation",
  payload,
}))
const mockHistoryPush = jest.fn()
const mockWindowClose = jest.fn()

const mockState = {
  qiReservation: {
    allocationRequest: {
      requestId: "allocation-request-1",
      reservationId: "quote-17:buyer",
      count: 4,
      zone: "0x00",
      account: 0,
      origin: "https://swap.qi.test",
      owner: "0x0000000000000000000000000000000000000000",
      chainId: "15000",
    },
  },
}

jest.mock("../../hooks", () => ({
  useBackgroundDispatch: () => mockDispatch,
  useBackgroundSelector: (selector: (state: typeof mockState) => unknown) =>
    selector(mockState),
}))

jest.mock("@pelagus/pelagus-background/redux-slices/qiReservation", () => ({
  confirmQiReservationAllocation: (payload: { requestId: string }) =>
    mockConfirm(payload),
  rejectQiReservationAllocation: (payload: { requestId: string }) =>
    mockReject(payload),
}))

jest.mock("react-router-dom", () => ({
  useHistory: () => ({ push: mockHistoryPush }),
}))

jest.mock(
  "../../components/Shared/_newDeisgn/pageHeaders/SharedGoBackPageHeader",
  () =>
    function SharedGoBackPageHeader({ onBack }: { onBack?: () => void }) {
      return (
        <button type="button" onClick={onBack}>
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

describe("QiReservationAllocationPage", () => {
  const originalWindowClose = window.close

  beforeEach(() => {
    jest.clearAllMocks()
    mockDispatch.mockResolvedValue({})
    Object.defineProperty(window, "close", {
      configurable: true,
      value: mockWindowClose,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, "close", {
      configurable: true,
      value: originalWindowClose,
    })
  })

  it("shows the exact origin, reservation, and four-slot recovery warning", () => {
    render(<QiReservationAllocationPage />)

    expect(
      screen.getByRole("heading", { name: "Reserve 4 Qi receive addresses?" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Requested by https://swap.qi.test")
    ).toBeInTheDocument()
    expect(screen.getByText("quote-17:buyer")).toBeInTheDocument()
    expect(
      screen.getByText(/at most four exposed, still-unused/i)
    ).toBeInTheDocument()
  })

  it("allocates only after approving the exact request", async () => {
    render(<QiReservationAllocationPage />)

    await userEvent.click(
      screen.getByRole("button", { name: "Reserve addresses" })
    )

    expect(mockConfirm).toHaveBeenCalledWith({
      requestId: "allocation-request-1",
    })
    await waitFor(() => expect(mockWindowClose).toHaveBeenCalledTimes(1))
    expect(mockReject).not.toHaveBeenCalled()
  })
})
