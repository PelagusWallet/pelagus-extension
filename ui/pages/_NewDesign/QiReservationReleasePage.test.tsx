import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import QiReservationReleasePage from "./QiReservationReleasePage"

const mockDispatch = jest.fn()
const mockConfirm = jest.fn((payload) => ({
  type: "qiReservation/confirmQiReservationRelease",
  payload,
}))
const mockReject = jest.fn((payload) => ({
  type: "qiReservation/rejectQiReservationRelease",
  payload,
}))
const mockHistoryPush = jest.fn()
const mockWindowClose = jest.fn()

type MockState = {
  qiReservation: {
    releaseRequest: {
      requestId: string
      reservationId: string
      count: number
      zone: string
      account: number
      origin: string
      reason: "terminal"
    } | null
  }
}

let mockState: MockState

jest.mock("../../hooks", () => ({
  useBackgroundDispatch: () => mockDispatch,
  useBackgroundSelector: (selector: (state: MockState) => unknown) =>
    selector(mockState),
}))

jest.mock("@pelagus/pelagus-background/redux-slices/qiReservation", () => ({
  confirmQiReservationRelease: (payload: { requestId: string }) =>
    mockConfirm(payload),
  rejectQiReservationRelease: (payload: { requestId: string }) =>
    mockReject(payload),
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

describe("QiReservationReleasePage", () => {
  const originalWindowClose = window.close

  beforeEach(() => {
    jest.clearAllMocks()
    mockDispatch.mockResolvedValue({})
    Object.defineProperty(window, "close", {
      configurable: true,
      value: mockWindowClose,
    })
    mockState = {
      qiReservation: {
        releaseRequest: {
          requestId: "release-request-1",
          reservationId: "quote-17:maker",
          count: 4,
          zone: "0x00",
          account: 0,
          origin: "https://swap.qi.test",
          reason: "terminal",
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

  it("explains the irreversible local retirement and exact request", () => {
    render(<QiReservationReleasePage />)

    expect(
      screen.getByRole("heading", { name: "Retire reserved addresses?" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Requested by https://swap.qi.test")
    ).toBeInTheDocument()
    expect(screen.getByText("https://swap.qi.test")).toBeInTheDocument()
    expect(screen.getByText("quote-17:maker")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(
      screen.getByText(/This cannot be undone in this profile/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/recovering from the seed alone may not include it/i)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Retire addresses" })
    ).toBeEnabled()
    expect(screen.getByRole("button", { name: "Keep addresses" })).toBeEnabled()
  })

  it("rejects the exact request before header Back closes the popup", async () => {
    let resolveDispatch: (() => void) | undefined
    mockDispatch.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDispatch = resolve
        })
    )

    render(<QiReservationReleasePage />)

    const headerBack = screen.getByRole("button", { name: "Header Back" })
    expect(headerBack).toHaveAttribute("data-prevent-navigation", "true")
    await userEvent.click(headerBack)

    expect(mockReject).toHaveBeenCalledTimes(1)
    expect(mockReject).toHaveBeenCalledWith({
      requestId: "release-request-1",
    })
    expect(mockWindowClose).not.toHaveBeenCalled()

    resolveDispatch?.()
    await waitFor(() => {
      expect(mockWindowClose).toHaveBeenCalledTimes(1)
      expect(mockHistoryPush).toHaveBeenCalledWith("/")
    })
  })

  it("rejects the exact request when the popup route unmounts", () => {
    const { unmount } = render(<QiReservationReleasePage />)

    unmount()

    expect(mockReject).toHaveBeenCalledTimes(1)
    expect(mockReject).toHaveBeenCalledWith({
      requestId: "release-request-1",
    })
  })

  it("confirms the exact request and does not reject it during close", async () => {
    render(<QiReservationReleasePage />)

    await userEvent.click(
      screen.getByRole("button", { name: "Retire addresses" })
    )

    expect(mockConfirm).toHaveBeenCalledTimes(1)
    expect(mockConfirm).toHaveBeenCalledWith({
      requestId: "release-request-1",
    })
    await waitFor(() => expect(mockWindowClose).toHaveBeenCalledTimes(1))
    expect(mockReject).not.toHaveBeenCalled()
  })
})
