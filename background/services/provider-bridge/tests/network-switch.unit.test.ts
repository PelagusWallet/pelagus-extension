import {
  EIP1193_ERROR_CODES,
  PermissionRequest,
} from "@pelagus-provider/provider-bridge-shared"
import {
  QuaiMainnet,
  QuaiOrchardTestnet,
} from "../../../constants/networks/networks"
import InternalQuaiProviderService from "../../internal-quai-provider"
import PreferenceService from "../../preferences"
import showExtensionPopup from "../show-popup"
import { initializeProviderBridgeDatabase } from "../db"
import ProviderBridgeService from ".."

jest.mock("../show-popup", () => jest.fn())

const ORIGIN = "https://app.test"
const ADDRESS = "0x0000000000000000000000000000000000000000"

const permission: PermissionRequest = {
  key: `${ORIGIN}_${ADDRESS}_9`,
  origin: ORIGIN,
  faviconUrl: "https://app.test/favicon.png",
  title: "Test dApp",
  state: "allow",
  accountAddress: ADDRESS,
  chainID: QuaiMainnet.chainID,
}

const popup = showExtensionPopup as jest.MockedFunction<
  typeof showExtensionPopup
>

async function createService() {
  const internal = {
    getCurrentInternalNetwork: jest.fn().mockResolvedValue(QuaiMainnet),
    routeSafeRPCRequest: jest.fn().mockResolvedValue(null),
  }
  const service = await ProviderBridgeService.create(
    Promise.resolve(internal as unknown as InternalQuaiProviderService),
    Promise.resolve({} as PreferenceService)
  )
  return { service, internal }
}

const switchTo = (service: ProviderBridgeService, chainId: string) =>
  service.routeContentScriptRPCRequest(
    permission,
    "wallet_switchEthereumChain",
    [{ chainId }],
    ORIGIN
  )

// Lets queued promise callbacks run.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("dApp network switch approval", () => {
  beforeEach(() => {
    popup.mockReset().mockResolvedValue({ id: 1 } as never)
  })

  it("switches to the current chain without a prompt", async () => {
    const { service, internal } = await createService()

    await expect(switchTo(service, "0x9")).resolves.toBeNull()
    expect(popup).not.toHaveBeenCalled()
    expect(internal.routeSafeRPCRequest).not.toHaveBeenCalled()
  })

  it("asks the user and switches only after approval", async () => {
    const { service, internal } = await createService()

    const request = switchTo(service, "15000")
    await flush()

    expect(popup).toHaveBeenCalledWith(
      "/add-evm-chain",
      { requestId: "0" },
      expect.any(Function)
    )
    expect(service.getNewCustomRPCDetails("0")).toEqual({
      origin: ORIGIN,
      siteTitle: permission.title,
      favicon: permission.faviconUrl,
      fromNetwork: QuaiMainnet,
      toNetwork: QuaiOrchardTestnet,
    })
    expect(internal.routeSafeRPCRequest).not.toHaveBeenCalled()

    service.handleAddNetworkRequest("0", true)

    await expect(request).resolves.toBeNull()
    expect(internal.routeSafeRPCRequest).toHaveBeenCalledWith(
      "wallet_switchEthereumChain",
      [{ chainId: "0x3a98" }],
      ORIGIN
    )
    expect(service.getNewCustomRPCDetails("0")).toBeUndefined()
  })

  it("rejects when the user closes the popup", async () => {
    const { service, internal } = await createService()

    const request = switchTo(service, "0x3a98")
    await flush()
    const onClose = popup.mock.calls[0][2] as () => void
    onClose()

    await expect(request).resolves.toMatchObject({
      code: EIP1193_ERROR_CODES.userRejectedRequest.code,
    })
    expect(internal.routeSafeRPCRequest).not.toHaveBeenCalled()
    // A late close after the answer is ignored.
    expect(() => service.handleAddNetworkRequest("0", false)).not.toThrow()
  })

  it("allows one pending switch per site", async () => {
    const { service } = await createService()

    const first = switchTo(service, "0x3a98")
    await flush()

    await expect(switchTo(service, "0x3a98")).resolves.toMatchObject({
      code: EIP1193_ERROR_CODES.requestAlreadyPending.code,
    })
    expect(popup).toHaveBeenCalledTimes(1)

    service.handleAddNetworkRequest("0", false)
    await first
  })

  it("treats wallet_addEthereumChain for a built-in chain as a switch", async () => {
    const { service, internal } = await createService()

    const request = service.routeContentScriptRPCRequest(
      permission,
      "wallet_addEthereumChain",
      [
        {
          chainId: "0x3a98",
          chainName: "Orchard",
          nativeCurrency: { name: "Quai", symbol: "QUAI", decimals: 18 },
          rpcUrls: ["https://orchard.rpc.quai.network"],
          blockExplorerUrls: ["https://orchard.quaiscan.io"],
        },
      ],
      ORIGIN
    )
    await flush()
    service.handleAddNetworkRequest("0", true)

    await expect(request).resolves.toBeNull()
    expect(internal.routeSafeRPCRequest).toHaveBeenCalledWith(
      "wallet_switchEthereumChain",
      [{ chainId: "0x3a98" }],
      ORIGIN
    )
  })

  it("rejects an unknown chain without a prompt", async () => {
    const { service } = await createService()

    await expect(switchTo(service, "0xfa")).resolves.toMatchObject({
      code: EIP1193_ERROR_CODES.chainDisconnected.code,
    })
    expect(popup).not.toHaveBeenCalled()
  })

  it("names both chains when a transaction targets another chain", async () => {
    const { service } = await createService()

    await expect(
      service.routeContentScriptRPCRequest(
        permission,
        "eth_sendTransaction",
        [{ chainId: "0x3a98", from: ADDRESS, to: ADDRESS }],
        ORIGIN
      )
    ).resolves.toMatchObject({
      code: EIP1193_ERROR_CODES.chainDisconnected.code,
      message: expect.stringMatching(/chain 0x3a98.*chain 0x9/),
    })
  })
})

describe("dApp permission lookup", () => {
  it("finds a connection granted on another chain", async () => {
    const db = await initializeProviderBridgeDatabase()
    await db.setPermission(permission)

    await expect(
      db.checkPermission(ORIGIN, ADDRESS, QuaiOrchardTestnet.chainID)
    ).resolves.toEqual({ ...permission, chainID: QuaiOrchardTestnet.chainID })
    await expect(
      db.checkPermission("https://other.test", ADDRESS, QuaiMainnet.chainID)
    ).resolves.toBeUndefined()
  })
})
