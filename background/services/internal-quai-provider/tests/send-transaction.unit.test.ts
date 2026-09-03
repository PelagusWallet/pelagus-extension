import { QuaiTransactionResponse } from "quais"
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
})
