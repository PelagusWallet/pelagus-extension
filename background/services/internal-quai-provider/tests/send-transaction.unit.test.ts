import { getAddress, QuaiTransactionResponse } from "quais"
import { EIP1193_ERROR_CODES } from "@pelagus-provider/provider-bridge-shared"
import { QuaiMainnet } from "../../../constants/networks/networks"
import ChainService from "../../chain"
import PreferenceService from "../../preferences"
import TransactionService from "../../transactions"
import InternalQuaiProviderService from ".."

jest.mock("../../../redux-slices/utils/contract-utils", () => ({
  internalProviderPort: {
    emitter: { on: jest.fn() },
    postResponse: jest.fn(),
  },
}))
jest.mock("../../chain")
jest.mock("../../preferences")
jest.mock("../../transactions")

const TEST_ADDRESS = "0x208e94d5661a73360d9387d3ca169e5c130090cd"
const NETWORK_GAS_PRICE = 28404727707008n

describe("InternalQuaiProviderService transaction chain binding", () => {
  let service: InternalQuaiProviderService
  const estimateGas = jest.fn()
  const getFeeData = jest.fn()

  beforeEach(async () => {
    estimateGas.mockReset().mockResolvedValue(42000n)
    getFeeData.mockReset().mockResolvedValue({ gasPrice: NETWORK_GAS_PRICE })
    service = await InternalQuaiProviderService.create(
      Promise.resolve({
        jsonRpcProvider: { estimateGas, getFeeData },
      } as unknown as ChainService),
      Promise.resolve({} as TransactionService),
      Promise.resolve({} as PreferenceService)
    )
    jest
      .spyOn(service, "getCurrentOrDefaultNetworkForOrigin")
      .mockResolvedValue(QuaiMainnet)
  })

  describe.each([
    ["quai_sendTransaction", "gasLimit"],
    ["eth_sendTransaction", "gas"],
  ])("%s gas limits", (method, gasField) => {
    it.each([
      ["0x0", NETWORK_GAS_PRICE],
      [0n, NETWORK_GAS_PRICE],
      [1, NETWORK_GAS_PRICE],
      ["10000000", NETWORK_GAS_PRICE],
      [NETWORK_GAS_PRICE.toString(), NETWORK_GAS_PRICE.toString()],
      [NETWORK_GAS_PRICE + 1n, NETWORK_GAS_PRICE + 1n],
      [undefined, undefined],
    ])(
      "checks gas price %s before estimation and approval",
      async (gasPrice, expectedPrice) => {
        const request = {
          from: TEST_ADDRESS,
          to: TEST_ADDRESS,
          gasPrice,
          [gasField]: "0x5208",
        }
        estimateGas.mockImplementationOnce(async (payload) => {
          expect(payload.gasPrice).toBe(expectedPrice)
          expect(payload.gasLimit).toBeUndefined()
          return 42000n
        })
        const approve = jest.fn(({ payload, resolver }) => {
          expect(payload.gasPrice).toBe(expectedPrice)
          expect(payload.gasLimit).toBe(42000n)
          resolver({ hash: "0x1234" } as QuaiTransactionResponse)
        })
        service.emitter.on("transactionSendRequest", approve)

        await expect(
          service.routeSafeRPCRequest(method, [request], "https://app.test")
        ).resolves.toBe("0x1234")

        if (gasPrice === undefined) {
          expect(getFeeData).not.toHaveBeenCalled()
        } else {
          expect(getFeeData).toHaveBeenCalledWith("0x20", true)
        }
        expect(estimateGas).toHaveBeenCalledTimes(1)
        expect(approve).toHaveBeenCalledTimes(1)
        expect(request.gasPrice).toBe(gasPrice)
      }
    )

    it.each(["unavailable", "failed"])(
      "rejects a %s gas price lookup before estimation or approval",
      async (failure) => {
        if (failure === "unavailable") {
          getFeeData.mockResolvedValueOnce({ gasPrice: null })
        } else {
          getFeeData.mockRejectedValueOnce(new Error("fee lookup failed"))
        }
        const approve = jest.fn()
        service.emitter.on("transactionSendRequest", approve)

        await expect(
          service.routeSafeRPCRequest(
            method,
            [
              {
                from: TEST_ADDRESS,
                to: TEST_ADDRESS,
                gasPrice: "0x0",
                [gasField]: "0x5208",
              },
            ],
            "https://app.test"
          )
        ).rejects.toThrow()
        expect(estimateGas).not.toHaveBeenCalled()
        expect(approve).not.toHaveBeenCalled()
      }
    )

    it.each([
      ["0x0", 42000n],
      ["0x5208", 42000n],
      [21000, 42000n],
      [21000n, 42000n],
      ["0xa410", "0xa410"],
      ["0x186a0", "0x186a0"],
    ])("checks supplied gas %s before approval", async (gas, expectedGas) => {
      const request = {
        from: TEST_ADDRESS,
        to: TEST_ADDRESS,
        data: "0x1234",
        value: "0x1",
        [gasField]: gas,
      }
      const approve = jest.fn(({ payload, resolver }) => {
        expect(payload.gasLimit).toBe(expectedGas)
        resolver({ hash: "0x1234" } as QuaiTransactionResponse)
      })
      service.emitter.on("transactionSendRequest", approve)

      await expect(
        service.routeSafeRPCRequest(method, [request], "https://app.test")
      ).resolves.toBe("0x1234")

      expect(estimateGas).toHaveBeenCalledWith(
        expect.objectContaining({
          from: getAddress(TEST_ADDRESS),
          to: getAddress(TEST_ADDRESS),
          data: "0x1234",
          value: "0x1",
          gasLimit: undefined,
        })
      )
      expect(estimateGas.mock.calls[0][0]).not.toHaveProperty("gas")
      expect(approve).toHaveBeenCalledTimes(1)
      expect(request[gasField]).toBe(gas)
    })

    it("rejects when estimation fails before requesting approval", async () => {
      estimateGas.mockRejectedValueOnce(new Error("estimation failed"))
      const approve = jest.fn()
      service.emitter.on("transactionSendRequest", approve)

      await expect(
        service.routeSafeRPCRequest(
          method,
          [{ from: TEST_ADDRESS, to: TEST_ADDRESS, [gasField]: "0x5208" }],
          "https://app.test"
        )
      ).rejects.toThrow("estimation failed")
      expect(approve).not.toHaveBeenCalled()
    })
  })

  it("preserves the dapp-requested chain ID in the signing payload", async () => {
    const emit = jest.spyOn(service.emitter, "emit")
    service.emitter.on("transactionSendRequest", ({ resolver }) => {
      resolver({ hash: "0x1234" } as QuaiTransactionResponse)
    })

    await expect(
      service.routeSafeRPCRequest(
        "quai_sendTransaction",
        [
          {
            chainId: "0x9",
            from: TEST_ADDRESS,
            to: "0x1111111111111111111111111111111111111111",
          },
        ],
        "https://app.test"
      )
    ).resolves.toBe("0x1234")

    expect(emit).toHaveBeenCalledWith(
      "transactionSendRequest",
      expect.objectContaining({
        payload: expect.objectContaining({
          chainId: "0x9",
          network: QuaiMainnet,
        }),
      })
    )
  })

  it("rejects a transaction for a chain other than the dapp network", async () => {
    const emit = jest.spyOn(service.emitter, "emit")

    await expect(
      service.routeSafeRPCRequest(
        "quai_sendTransaction",
        [
          {
            chainId: "0x3a98",
            from: TEST_ADDRESS,
            to: "0x1111111111111111111111111111111111111111",
          },
        ],
        "https://app.test"
      )
    ).rejects.toThrow(
      "The requested method and/or account has not been authorized by the user."
    )

    expect(emit).not.toHaveBeenCalledWith(
      "transactionSendRequest",
      expect.anything()
    )
  })

  it("rejects a concurrent signing request before it can share the active response", async () => {
    let resolveFirstRequest:
      | ((response: QuaiTransactionResponse) => void)
      | undefined
    const transactionRequest = jest.fn(
      ({
        resolver,
      }: {
        resolver: (response: QuaiTransactionResponse) => void
      }) => {
        resolveFirstRequest = resolver
      }
    )
    const signDataRequest = jest.fn()
    service.emitter.on("transactionSendRequest", transactionRequest)
    service.emitter.on("signDataRequest", signDataRequest)

    const firstRequest = service.routeSafeRPCRequest(
      "quai_sendTransaction",
      [
        {
          chainId: "0x9",
          from: TEST_ADDRESS,
          to: "0x1111111111111111111111111111111111111111",
        },
      ],
      "https://first.test"
    )

    await Promise.resolve()

    await expect(
      service.routeSafeRPCRequest(
        "personal_sign",
        ["0x1234", TEST_ADDRESS],
        "https://second.test"
      )
    ).rejects.toMatchObject({
      eip1193Error: EIP1193_ERROR_CODES.requestAlreadyPending,
    })

    expect(transactionRequest).toHaveBeenCalledTimes(1)
    expect(signDataRequest).not.toHaveBeenCalled()

    resolveFirstRequest?.({ hash: "0x1234" } as QuaiTransactionResponse)
    await expect(firstRequest).resolves.toBe("0x1234")
  })

  it("releases the approval gate after a request is rejected", async () => {
    service.emitter.on("signDataRequest", ({ rejecter }) => {
      rejecter(new Error("rejected"))
    })

    await expect(
      service.routeSafeRPCRequest(
        "personal_sign",
        ["0x1234", TEST_ADDRESS],
        "https://first.test"
      )
    ).rejects.toThrow("rejected")

    await expect(
      service.routeSafeRPCRequest(
        "personal_sign",
        ["0x5678", TEST_ADDRESS],
        "https://second.test"
      )
    ).rejects.toThrow("rejected")
  })
})
