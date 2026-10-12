import browser from "webextension-polyfill"
// eslint-disable-next-line import/no-extraneous-dependencies
import { waitFor } from "@testing-library/dom"
import { EIP1193_ERROR_CODES } from "@pelagus-provider/provider-bridge-shared"
import {
  createInternalQuaiProviderService,
  createProviderBridgeService,
} from "../../../tests/factories"
import ProviderBridgeService from "../index"
import InternalQuaiProviderService from "../../internal-quai-provider"
import {
  QuaiMainnet,
  QuaiOrchardTestnet,
} from "../../../constants/networks/networks"

jest.mock("../show-popup", () => ({
  __esModule: true,
  default: jest.fn(async () => ({ id: 1 })),
}))

const ORIGIN = "https://app.test"
const ENABLING_PERMISSION = {
  key: `${ORIGIN}_0x0000000000000000000000000000000000000000_9`,
  origin: ORIGIN,
  faviconUrl: "",
  title: "Test",
  state: "allow" as const,
  accountAddress: "0x0000000000000000000000000000000000000000",
  chainID: "9",
}

const switchTo = (service: ProviderBridgeService, chainId: string) =>
  service.routeContentScriptRPCRequest(
    ENABLING_PERMISSION,
    "wallet_switchEthereumChain",
    [{ chainId }, "Test", "https://app.test/favicon.png"],
    ORIGIN
  )

// The pending request id the service assigns to the first prompt.
const FIRST_REQUEST_ID = "0"

const waitForPrompt = (service: ProviderBridgeService) =>
  waitFor(() =>
    expect(
      service.getSwitchNetworkRequestDetails(FIRST_REQUEST_ID)
    ).toBeDefined()
  )

describe("dApp-initiated network switches", () => {
  let service: ProviderBridgeService
  let internalQuaiProviderService: InternalQuaiProviderService

  beforeEach(async () => {
    // jest-webextension-mock does not provide the windows event.
    Object.assign(browser, {
      windows: {
        ...browser.windows,
        onRemoved: { addListener: jest.fn(), removeListener: jest.fn() },
      },
    })
    internalQuaiProviderService = await createInternalQuaiProviderService()
    service = await createProviderBridgeService({
      internalQuaiProviderService: Promise.resolve(internalQuaiProviderService),
    })
  })

  it("does not switch until the user approves", async () => {
    const pending = switchTo(service, "0x3a98")
    await waitForPrompt(service)

    // Nothing is decided yet; the dApp is still waiting.
    await expect(
      Promise.race([pending, Promise.resolve("still-pending")])
    ).resolves.toBe("still-pending")

    const selectedNetwork = jest.fn()
    internalQuaiProviderService.emitter.on("selectedNetwork", selectedNetwork)

    service.handleSwitchNetworkRequest(FIRST_REQUEST_ID, true)

    await expect(pending).resolves.toBeNull()
    // Approval moves the wallet, which is what every dApp is then told about.
    expect(selectedNetwork).toHaveBeenCalledWith(
      expect.objectContaining({ chainID: "15000" })
    )
  })

  it("rejects the request when the user declines", async () => {
    const pending = switchTo(service, "0x3a98")
    await waitForPrompt(service)
    service.handleSwitchNetworkRequest(FIRST_REQUEST_ID, false)

    const result = (await pending) as { code?: number }
    expect(result?.code).toBe(EIP1193_ERROR_CODES.userRejectedRequest.code)

    // ...and the wallet was never asked to move.
    await expect(
      service.routeContentScriptRPCRequest(
        ENABLING_PERMISSION,
        "eth_chainId",
        [],
        ORIGIN
      )
    ).resolves.toBe("0x9")
  })

  it("does not prompt when the dApp asks for the current chain", async () => {
    const selectedNetwork = jest.fn()
    internalQuaiProviderService.emitter.on("selectedNetwork", selectedNetwork)

    await expect(switchTo(service, "0x9")).resolves.toBeNull()

    // Nothing changed, so nothing is announced: no spurious chainChanged.
    expect(selectedNetwork).not.toHaveBeenCalled()
  })

  it("does not prompt for the wallet's chain, whichever one the dApp connected on", async () => {
    // The user already moved the wallet to Orchard; this dApp connected on
    // mainnet. Asking for the chain the wallet is on is not a switch.
    await internalQuaiProviderService.switchToSupportedNetwork(
      ORIGIN,
      QuaiMainnet
    )
    await internalQuaiProviderService.setSelectedNetwork(QuaiOrchardTestnet)

    await expect(switchTo(service, "0x3a98")).resolves.toBeNull()
    expect(
      service.getSwitchNetworkRequestDetails(FIRST_REQUEST_ID)
    ).toBeUndefined()
  })
})
