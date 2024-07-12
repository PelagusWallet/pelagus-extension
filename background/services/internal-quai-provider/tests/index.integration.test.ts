import sinon from "sinon"
import InternalQuaiProviderService from ".."
import * as featureFlags from "../../../features"
import {
  createChainService,
  createInternalQuaiProviderService,
} from "../../../tests/factories"
import { validateAddEthereumChainParameter } from "../../provider-bridge/utils"
import { SignTypedDataRequest } from "../../../utils/signing"
import { EIP712TypedData } from "../../../types"
import { QuaiNetworkGA } from "../../../constants/networks/networks"
import { NetworkInterfaceGA } from "../../../constants/networks/networkTypes"

const TEST_ADDRESS = "0x208e94d5661a73360d9387d3ca169e5c130090cd"

describe("Internal Quai Provider Service", () => {
  const sandbox = sinon.createSandbox()
  let IQPService: InternalQuaiProviderService

  beforeEach(async () => {
    sandbox.restore()
    IQPService = await createInternalQuaiProviderService()
    await IQPService.startService()
  })

  afterEach(async () => {
    await IQPService.stopService()
  })

  it("should correctly persist chains sent in via wallet_addEthereumChain", async () => {
    const chainService = createChainService()

    jest.spyOn(featureFlags, "isEnabled").mockImplementation(() => true)

    IQPService = await createInternalQuaiProviderService({ chainService })
    const startedChainService = await chainService
    await startedChainService.startService()
    await IQPService.startService()
    const method = "wallet_addEthereumChain"
    const origin = "https://chainlist.org"

    const EIP3085Params = [
      validateAddEthereumChainParameter({
        chainId: "0xfa",
        chainName: "Fantom Opera",
        nativeCurrency: { name: "Fantom", symbol: "FTM", decimals: 18 },
        rpcUrls: [
          "https://fantom-mainnet.gateway.pokt.network/v1/lb/62759259ea1b320039c9e7ac",
          "https://rpc.ftm.tools",
          "https://rpc.ankr.com/fantom",
          "https://rpc.fantom.network",
        ],
        blockExplorerUrls: ["https://ftmscan.com"],
      }),
      "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    ]

    await IQPService.routeSafeRPCRequest(method, EIP3085Params, origin)

    expect(
      startedChainService.supportedNetworks.find(
        (network: NetworkInterfaceGA) =>
          network.baseAsset.name === "Fantom Opera"
      )
    ).toBeTruthy()
  })

  it.each(["", "_v1", "_v3", "_v4"])(
    "should filter out fields not specified in 'types' of eth_signTypedData",
    async (version) => {
      const method = `eth_signTypedData${version}`
      const origin = ""

      const types = {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Request: [{ name: "text", type: "string" }],
      }

      const primaryType = "Request"

      const domain = {
        name: "EIP-712 Test",
        version: "1",
        chainId: "1",
        verifyingContract: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      }

      const EIP712Object: EIP712TypedData = {
        types,
        domain,
        primaryType,
        message: {
          "": "This should be removed",
          "text ": "This should be removed",
          " text": "This should be removed",
          text: "This is correct",
        },
      }

      const EIP712ObjectFiltered: SignTypedDataRequest = {
        account: {
          address: TEST_ADDRESS,
          network: QuaiNetworkGA,
        },
        typedData: {
          types,
          domain,
          primaryType,
          message: { text: "This is correct" },
        },
      }

      const EIP712Params = [TEST_ADDRESS, JSON.stringify(EIP712Object)]

      jest.spyOn(IQPService.emitter, "emit")

      IQPService.emitter.on("signTypedDataRequest", ({ resolver }) => {
        resolver("") // We have to manually resolve promise here
      })

      await IQPService.routeSafeRPCRequest(method, EIP712Params, origin)

      expect(IQPService.emitter.emit).toHaveBeenCalledWith(
        "signTypedDataRequest",
        expect.objectContaining({
          payload: EIP712ObjectFiltered,
        })
      )
    }
  )
})
