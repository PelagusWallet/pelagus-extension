import { EIP1193_ERROR_CODES } from "@pelagus-provider/provider-bridge-shared"
import PendingRequestTracker from "../pending-requests"

describe("PendingRequestTracker", () => {
  it("does not reject requests that received a response", () => {
    const tracker = new PendingRequestTracker()

    tracker.track({ id: "settled-request" })
    tracker.settle({ id: "settled-request", result: "0x1" })

    expect(tracker.takeDisconnectResponses()).toEqual([])
  })

  it("rejects every outstanding request exactly once after a disconnect", () => {
    const tracker = new PendingRequestTracker()

    tracker.track({ id: "first-request" })
    tracker.track({ id: "second-request" })

    expect(tracker.takeDisconnectResponses()).toEqual([
      {
        id: "first-request",
        jsonrpc: "2.0",
        result: EIP1193_ERROR_CODES.disconnected,
      },
      {
        id: "second-request",
        jsonrpc: "2.0",
        result: EIP1193_ERROR_CODES.disconnected,
      },
    ])
    expect(tracker.takeDisconnectResponses()).toEqual([])
  })

  it("ignores internal messages without request IDs", () => {
    const tracker = new PendingRequestTracker()

    tracker.track({ request: { method: "pelagus_getConfig" } })

    expect(tracker.takeDisconnectResponses()).toEqual([])
  })
})
