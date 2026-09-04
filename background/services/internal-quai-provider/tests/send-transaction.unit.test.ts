import { QuaiTransactionResponse } from "quais"
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

describe("InternalQuaiProviderService transaction chain binding", () => {
  let service: InternalQuaiProviderService

  beforeEach(async () => {
    service = await InternalQuaiProviderService.create(
      Promise.resolve({} as ChainService),
      Promise.resolve({} as TransactionService),
      Promise.resolve({} as PreferenceService)
    )
    jest
      .spyOn(service, "getCurrentOrDefaultNetworkForOrigin")
      .mockResolvedValue(QuaiMainnet)
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
