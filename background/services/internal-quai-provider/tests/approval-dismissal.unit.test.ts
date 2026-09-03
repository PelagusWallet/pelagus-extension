import Emittery from "emittery"
import { EIP1193_ERROR_CODES } from "@pelagus-provider/provider-bridge-shared"
import Main from "../../../main"
import { QuaiMainnet } from "../../../constants/networks/networks"
import { signingSliceEmitter } from "../../../redux-slices/signing"
import { emitter as uiSliceEmitter } from "../../../redux-slices/ui"
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

const ADDRESS = "0x208e94d5661a73360d9387d3ca169e5c130090cd"

it("releases a dismissed typed-data approval during preparation without restoring stale UI", async () => {
  const service = await InternalQuaiProviderService.create(
    Promise.resolve({} as ChainService),
    Promise.resolve({} as TransactionService),
    Promise.resolve({} as PreferenceService)
  )
  jest
    .spyOn(service, "getCurrentOrDefaultNetworkForOrigin")
    .mockResolvedValue(QuaiMainnet)
  let finishPreparation!: () => void
  const preparation = new Promise<void>((resolve) => {
    finishPreparation = resolve
  })
  let startedPreparation!: () => void
  const started = new Promise<void>((resolve) => {
    startedPreparation = resolve
  })
  const responses = new Emittery()
  const dispatch = jest.fn()
  const main = {
    internalQuaiProviderService: service,
    signingService: { emitter: responses },
    enrichmentService: {
      enrichSignTypedDataRequest: async (payload: unknown) => {
        startedPreparation()
        await preparation
        return payload
      },
    },
    store: { dispatch },
  } as unknown as Main
  await Main.prototype.connectInternalQuaiProviderService.call(main)

  try {
    const first = service.routeSafeRPCRequest(
      "eth_signTypedData_v4",
      [
        ADDRESS,
        JSON.stringify({
          domain: {},
          types: { Message: [{ name: "text", type: "string" }] },
          message: { text: "hello" },
        }),
      ],
      "https://first.test"
    )
    const rejected = expect(first).rejects.toMatchObject({
      eip1193Error: EIP1193_ERROR_CODES.userRejectedRequest,
    })
    await started
    // This is the event dispatched by the existing popup-disconnect handler.
    await signingSliceEmitter.emit("signatureRejected")
    await rejected
    expect(responses.listenerCount("signingDataResponse")).toBe(0)

    const nextReady = service.emitter.once("signDataRequest")
    const next = service.routeSafeRPCRequest(
      "personal_sign",
      ["0x1234", ADDRESS],
      "https://second.test"
    )
    await nextReady
    await responses.emit("personalSigningResponse", {
      type: "success-data",
      signedData: "0xbeef",
    })
    await expect(next).resolves.toBe("0xbeef")

    dispatch.mockClear()
    finishPreparation()
    await preparation
    await Promise.resolve()
    expect(dispatch).not.toHaveBeenCalled()
    expect(signingSliceEmitter.listenerCount("signatureRejected")).toBe(0)
  } finally {
    finishPreparation()
    service.emitter.clearListeners()
    responses.clearListeners()
    signingSliceEmitter.clearListeners()
    uiSliceEmitter.clearListeners()
  }
})
