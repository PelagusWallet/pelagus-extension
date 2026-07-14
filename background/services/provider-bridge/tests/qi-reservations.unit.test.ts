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
  const reservationParams = [
    {
      reservationId: "fill:payout",
      count: 1,
      zone: "cyprus1",
      account: 0,
    },
  ]

  it("routes allocation through its request-scoped confirmation flow", async () => {
    const routeSafeRPCRequest = jest.fn()
    const routeQiReservationAllocationRequest = jest
      .fn()
      .mockResolvedValue({ status: "active" })
    const service = Object.create(
      ProviderBridgeService.prototype
    ) as ProviderBridgeService
    Object.defineProperty(service, "internalQuaiProviderService", {
      value: { routeSafeRPCRequest },
    })
    Object.defineProperty(service, "routeQiReservationAllocationRequest", {
      value: routeQiReservationAllocationRequest,
    })

    await expect(
      service.routeContentScriptRPCRequest(
        permission,
        "qi_getReceiveAddresses",
        reservationParams,
        permission.origin
      )
    ).resolves.toEqual({ status: "active" })
    expect(routeQiReservationAllocationRequest).toHaveBeenCalledWith(
      permission,
      reservationParams,
      permission.origin
    )
    expect(routeSafeRPCRequest).not.toHaveBeenCalled()
  })

  it("keeps reservation commit on the trusted-origin internal provider", async () => {
    const routeSafeRPCRequest = jest.fn().mockResolvedValue({ ok: true })
    const service = Object.create(
      ProviderBridgeService.prototype
    ) as ProviderBridgeService
    Object.defineProperty(service, "internalQuaiProviderService", {
      value: { routeSafeRPCRequest },
    })

    await expect(
      service.routeContentScriptRPCRequest(
        permission,
        "qi_commitReceiveAddressReservation",
        reservationParams,
        permission.origin
      )
    ).resolves.toEqual({ ok: true })
    expect(routeSafeRPCRequest).toHaveBeenCalledWith(
      "qi_commitReceiveAddressReservation",
      reservationParams,
      permission.origin
    )
  })

  it("revalidates account, network, and permission before allocating", async () => {
    const allocateQiReceiveAddressReservation = jest.fn().mockResolvedValue({
      reservationId: "fill:payout",
      addresses: ["0x0080000000000000000000000000000000000001"],
      status: "active",
      expiresAt: 1000,
      addressCapacity: 4,
      remainingAddressCapacity: 3,
    })
    const service = Object.create(
      ProviderBridgeService.prototype
    ) as ProviderBridgeService
    Object.assign(service as any, {
      preferenceService: {
        getSelectedAccount: jest.fn().mockResolvedValue({
          address: permission.accountAddress,
        }),
      },
      internalQuaiProviderService: {
        getCurrentOrDefaultNetworkForOrigin: jest
          .fn()
          .mockResolvedValue({ chainID: permission.chainID }),
        allocateQiReceiveAddressReservation,
      },
      pendingQiReservationAllocations: new Map(),
    })
    Object.defineProperty(service, "checkPermission", {
      value: jest.fn().mockResolvedValue(permission),
    })
    const pending = {
      requestId: "qi-reservation-allocation-1",
      request: {
        ...reservationParams[0],
        zone: "cyprus1",
        origin: permission.origin,
        owner: permission.accountAddress,
        chainId: permission.chainID,
      },
      state: "pending",
      resolve: jest.fn(),
      reject: jest.fn(),
    }
    ;(service as any).pendingQiReservationAllocations.set(
      pending.requestId,
      pending
    )

    await expect(
      service.confirmQiReservationAllocation(pending.requestId)
    ).resolves.toMatchObject({ status: "active" })
    expect(allocateQiReceiveAddressReservation).toHaveBeenCalledWith(
      pending.request
    )
  })

  it("routes release through its request-scoped confirmation flow", async () => {
    const routeSafeRPCRequest = jest.fn()
    const routeQiReservationReleaseRequest = jest
      .fn()
      .mockResolvedValue({ status: "released" })
    const service = Object.create(
      ProviderBridgeService.prototype
    ) as ProviderBridgeService
    Object.defineProperty(service, "internalQuaiProviderService", {
      value: { routeSafeRPCRequest },
    })
    Object.defineProperty(service, "routeQiReservationReleaseRequest", {
      value: routeQiReservationReleaseRequest,
    })
    const params = [
      {
        reservationId: "fill:payout",
        count: 1,
        zone: "cyprus1",
        account: 0,
        reason: "accepted-fill-timeout",
      },
    ]

    await expect(
      service.routeContentScriptRPCRequest(
        permission,
        "qi_releaseReceiveAddressReservation",
        params,
        "https://app.test"
      )
    ).resolves.toEqual({ status: "released" })
    expect(routeQiReservationReleaseRequest).toHaveBeenCalledWith(
      permission,
      params,
      "https://app.test"
    )
    expect(routeSafeRPCRequest).not.toHaveBeenCalled()
  })

  it("revalidates account, network, and live permission before release", async () => {
    const releaseQiReceiveAddressReservation = jest.fn().mockResolvedValue({
      reservationId: "fill:payout",
      status: "released",
      releasedAt: 1,
      alreadyReleased: false,
      reason: "accepted-fill-timeout",
    })
    const service = Object.create(
      ProviderBridgeService.prototype
    ) as ProviderBridgeService
    Object.assign(service as any, {
      preferenceService: {
        getSelectedAccount: jest.fn().mockResolvedValue({
          address: permission.accountAddress,
        }),
      },
      internalQuaiProviderService: {
        getCurrentOrDefaultNetworkForOrigin: jest
          .fn()
          .mockResolvedValue({ chainID: permission.chainID }),
        releaseQiReceiveAddressReservation,
      },
      pendingQiReservationReleases: new Map(),
    })
    Object.defineProperty(service, "checkPermission", {
      value: jest.fn().mockResolvedValue(permission),
    })
    const pending = {
      requestId: "qi-reservation-release-1",
      request: {
        reservationId: "fill:payout",
        count: 1,
        zone: "cyprus1",
        account: 0,
        origin: permission.origin,
        owner: permission.accountAddress,
        chainId: permission.chainID,
        reason: "accepted-fill-timeout",
      },
      state: "pending",
      resolve: jest.fn(),
      reject: jest.fn(),
    }
    ;(service as any).pendingQiReservationReleases.set(
      pending.requestId,
      pending
    )

    await expect(
      service.confirmQiReservationRelease(pending.requestId)
    ).resolves.toMatchObject({ status: "released" })
    expect(releaseQiReceiveAddressReservation).toHaveBeenCalledWith(
      pending.request
    )
  })

  it.each([
    {
      boundary: "selected account changes",
      selectedAddress: "0x1111111111111111111111111111111111111111",
      chainID: permission.chainID,
      livePermission: permission,
    },
    {
      boundary: "origin network changes",
      selectedAddress: permission.accountAddress,
      chainID: "9000",
      livePermission: permission,
    },
    {
      boundary: "permission is revoked",
      selectedAddress: permission.accountAddress,
      chainID: permission.chainID,
      livePermission: undefined,
    },
  ])("fails closed when $boundary before approval", async (scenario) => {
    const releaseQiReceiveAddressReservation = jest.fn()
    const service = Object.create(
      ProviderBridgeService.prototype
    ) as ProviderBridgeService
    Object.assign(service as any, {
      preferenceService: {
        getSelectedAccount: jest.fn().mockResolvedValue({
          address: scenario.selectedAddress,
        }),
      },
      internalQuaiProviderService: {
        getCurrentOrDefaultNetworkForOrigin: jest
          .fn()
          .mockResolvedValue({ chainID: scenario.chainID }),
        releaseQiReceiveAddressReservation,
      },
      pendingQiReservationReleases: new Map(),
    })
    Object.defineProperty(service, "checkPermission", {
      value: jest.fn().mockResolvedValue(scenario.livePermission),
    })
    const pending = {
      requestId: "qi-reservation-release-2",
      request: {
        reservationId: "fill:payout",
        count: 1,
        zone: "cyprus1",
        account: 0,
        origin: permission.origin,
        owner: permission.accountAddress,
        chainId: permission.chainID,
        reason: "accepted-fill-timeout",
      },
      state: "pending",
      resolve: jest.fn(),
      reject: jest.fn(),
    }
    ;(service as any).pendingQiReservationReleases.set(
      pending.requestId,
      pending
    )

    await expect(
      service.confirmQiReservationRelease(pending.requestId)
    ).rejects.toBeDefined()
    expect(releaseQiReceiveAddressReservation).not.toHaveBeenCalled()
    expect(pending.reject).toHaveBeenCalledTimes(1)
  })

  it("rejects only the exact active request and settles it once", () => {
    const service = Object.create(
      ProviderBridgeService.prototype
    ) as ProviderBridgeService
    Object.assign(service as any, {
      pendingQiReservationReleases: new Map(),
    })
    const pending = {
      requestId: "qi-reservation-release-3",
      request: {},
      state: "pending",
      resolve: jest.fn(),
      reject: jest.fn(),
    }
    ;(service as any).pendingQiReservationReleases.set(
      pending.requestId,
      pending
    )

    service.rejectQiReservationRelease("qi-reservation-release-stale")
    expect(pending.reject).not.toHaveBeenCalled()

    service.rejectQiReservationRelease(pending.requestId)
    service.rejectQiReservationRelease(pending.requestId)
    expect(pending.reject).toHaveBeenCalledTimes(1)
  })

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
