import { EIP1193_ERROR_CODES } from "@pelagus-provider/provider-bridge-shared"
import {
  QuaiMainnet,
  QuaiOrchardTestnet,
} from "../../../constants/networks/networks"
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

const ORIGIN = "https://app.test"

describe("InternalQuaiProviderService chain switching", () => {
  let service: InternalQuaiProviderService
  let selected: jest.Mock

  beforeEach(async () => {
    service = await InternalQuaiProviderService.create(
      Promise.resolve({} as ChainService),
      Promise.resolve({} as TransactionService),
      Promise.resolve({} as PreferenceService)
    )
    jest
      .spyOn(service, "getCurrentInternalNetwork")
      .mockResolvedValue(QuaiMainnet)
    selected = jest.fn()
    service.emitter.on("selectedNetwork", selected)
  })

  it.each([
    ["wallet_switchEthereumChain", "0x3a98"],
    ["wallet_switchEthereumChain", "15000"],
    ["wallet_addEthereumChain", "15000"],
  ])("%s %s selects the matching network", async (method, chainId) => {
    await expect(
      service.routeSafeRPCRequest(method, [{ chainId }], ORIGIN)
    ).resolves.toBeNull()
    expect(selected).toHaveBeenCalledWith(QuaiOrchardTestnet)
  })

  it("does not reselect the current network", async () => {
    await expect(
      service.routeSafeRPCRequest(
        "wallet_switchEthereumChain",
        [{ chainId: "0x9" }],
        ORIGIN
      )
    ).resolves.toBeNull()
    expect(selected).not.toHaveBeenCalled()
  })

  it.each(["wallet_switchEthereumChain", "wallet_addEthereumChain"])(
    "%s rejects an unknown chain",
    async (method) => {
      await expect(
        service.routeSafeRPCRequest(method, [{ chainId: "0xfa" }], ORIGIN)
      ).rejects.toMatchObject({
        eip1193Error: EIP1193_ERROR_CODES.chainDisconnected,
      })
      expect(selected).not.toHaveBeenCalled()
    }
  )

  it("reports the wallet's network for chain ID requests", async () => {
    await expect(
      service.routeSafeRPCRequest("eth_chainId", [], ORIGIN)
    ).resolves.toBe("0x9")
    await expect(
      service.routeSafeRPCRequest("net_version", [], ORIGIN)
    ).resolves.toBe("9")
  })
})
