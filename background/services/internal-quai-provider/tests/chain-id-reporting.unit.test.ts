import { createInternalQuaiProviderService } from "../../../tests/factories"
import InternalQuaiProviderService from ".."
import { PELAGUS_INTERNAL_ORIGIN } from "../constants"
import { QuaiOrchardTestnet } from "../../../constants/networks/networks"

const ORIGIN = "https://app.test"

describe("chain id reported to dApps", () => {
  let service: InternalQuaiProviderService

  beforeEach(async () => {
    service = await createInternalQuaiProviderService()
  })

  it("accepts an EIP-3326 hex chainId when switching chains", async () => {
    // EIP-3326: dApps send chainId as a hex string, where Pelagus stores
    // chain ids in decimal.
    await expect(
      service.routeSafeRPCRequest(
        "wallet_switchEthereumChain",
        [{ chainId: "0x3a98" }], // 15000, Orchard
        ORIGIN
      )
    ).resolves.toBeNull()
  })

  it("asks the wallet to move to the requested chain", async () => {
    const selectedNetwork = jest.fn()
    service.emitter.on("selectedNetwork", selectedNetwork)

    await service.routeSafeRPCRequest(
      "wallet_switchEthereumChain",
      [{ chainId: "0x3a98" }],
      ORIGIN
    )

    expect(selectedNetwork).toHaveBeenCalledWith(
      expect.objectContaining({ chainID: "15000" })
    )
  })

  it("rejects a chain the wallet does not support", async () => {
    await expect(
      service.routeSafeRPCRequest(
        "wallet_switchEthereumChain",
        [{ chainId: "0x1" }],
        ORIGIN
      )
    ).rejects.toThrow()
  })

  it("reports the wallet's network, not the one the dApp connected on", async () => {
    await service.setSelectedNetwork(QuaiOrchardTestnet)

    // Every RPC call and transaction this dApp makes is served by the wallet's
    // node, so that is the chain it must be told about.
    await expect(
      service.routeSafeRPCRequest("quai_chainId", [], ORIGIN)
    ).resolves.toBe("0x3a98")

    await expect(
      service.routeSafeRPCRequest("quai_chainId", [], PELAGUS_INTERNAL_ORIGIN)
    ).resolves.toBe("0x3a98")
  })

  it("answers net_version and eth_chainId with the same chain", async () => {
    await service.setSelectedNetwork(QuaiOrchardTestnet)

    const [chainId, netVersion] = await Promise.all([
      service.routeSafeRPCRequest("eth_chainId", [], ORIGIN),
      service.routeSafeRPCRequest("net_version", [], ORIGIN),
    ])

    expect(chainId).toBe("0x3a98")
    expect(netVersion).toBe("15000")
  })
})
