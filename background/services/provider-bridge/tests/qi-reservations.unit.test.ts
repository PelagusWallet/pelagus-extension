import { PermissionRequest } from "@pelagus-provider/provider-bridge-shared"

import ProviderBridgeService from ".."

const permission = {
  key: "https://app.test_0x0000000000000000000000000000000000000000_15000",
  origin: "https://app.test",
  state: "allow",
  accountAddress: "0x0000000000000000000000000000000000000000",
  chainID: "15000",
} as PermissionRequest

describe("ProviderBridgeService Qi receive reservation routing", () => {
  it.each([
    "qi_getReceiveAddresses",
    "qi_commitReceiveAddressReservation",
    "qi_releaseReceiveAddressReservation",
  ])(
    "routes %s through the trusted-origin internal provider",
    async (method) => {
      const routeSafeRPCRequest = jest.fn().mockResolvedValue({ ok: true })
      const service = Object.create(
        ProviderBridgeService.prototype
      ) as ProviderBridgeService
      Object.defineProperty(service, "internalQuaiProviderService", {
        value: { routeSafeRPCRequest },
      })
      const params = [
        {
          reservationId: "fill:payout",
          count: 1,
          zone: "cyprus1",
          account: 0,
          ...(method === "qi_releaseReceiveAddressReservation"
            ? { reason: "terminal" }
            : {}),
        },
      ]

      await expect(
        service.routeContentScriptRPCRequest(
          permission,
          method,
          params,
          "https://app.test"
        )
      ).resolves.toEqual({ ok: true })
      expect(routeSafeRPCRequest).toHaveBeenCalledWith(
        method,
        params,
        "https://app.test"
      )
    }
  )

  it("does not expose the legacy qi_sendTransaction alias", async () => {
    const routeSafeRPCRequest = jest
      .fn()
      .mockResolvedValue({ unsupported: true })
    const routeQiSendRequest = jest.fn()
    const service = Object.create(
      ProviderBridgeService.prototype
    ) as ProviderBridgeService
    Object.defineProperty(service, "internalQuaiProviderService", {
      value: { routeSafeRPCRequest },
    })
    Object.defineProperty(service, "routeQiSendRequest", {
      value: routeQiSendRequest,
    })

    await expect(
      service.routeContentScriptRPCRequest(
        permission,
        "qi_sendTransaction",
        [],
        "https://app.test"
      )
    ).resolves.toEqual({ unsupported: true })
    expect(routeQiSendRequest).not.toHaveBeenCalled()
    expect(routeSafeRPCRequest).toHaveBeenCalledWith(
      "qi_sendTransaction",
      [],
      "https://app.test"
    )
  })
})
