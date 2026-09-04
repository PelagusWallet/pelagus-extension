import {
  EIP1193Error,
  EIP1193_ERROR_CODES,
  PortResponseEvent,
  isObject,
  isString,
} from "@pelagus-provider/provider-bridge-shared"

export default class PendingRequestTracker {
  private requestIDs = new Set<string>()

  track(request: unknown): void {
    if (isObject(request) && isString(request.id)) {
      this.requestIDs.add(request.id)
    }
  }

  settle(response: unknown): void {
    if (isObject(response) && isString(response.id)) {
      this.requestIDs.delete(response.id)
    }
  }

  takeDisconnectResponses(): Array<PortResponseEvent> {
    const disconnectedError = new EIP1193Error(
      EIP1193_ERROR_CODES.disconnected
    ).toJSON()
    const responses = Array.from(this.requestIDs, (id) => ({
      id,
      jsonrpc: "2.0" as const,
      result: disconnectedError,
    }))

    this.requestIDs.clear()

    return responses
  }
}
