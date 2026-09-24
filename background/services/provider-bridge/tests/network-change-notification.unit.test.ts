import { Runtime } from "webextension-polyfill"
import {
  PELAGUS_GET_CONFIG_METHOD,
  PELAGUS_INTERNAL_COMMUNICATION_ID,
} from "@pelagus-provider/provider-bridge-shared"
import { createProviderBridgeService } from "../../../tests/factories"
import ProviderBridgeService from "../index"

describe("notifying dApps that the wallet changed network", () => {
  let providerBridgeService: ProviderBridgeService
  let postMessage: jest.Mock

  beforeEach(async () => {
    providerBridgeService = await createProviderBridgeService()
    postMessage = jest.fn()
    providerBridgeService.openPorts = [
      { postMessage } as unknown as Runtime.Port,
    ]
  })

  it("tells open pages the new chain, as hex", async () => {
    await providerBridgeService.notifyContentScriptsAboutNetworkChange("15000")

    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PELAGUS_INTERNAL_COMMUNICATION_ID,
        result: expect.objectContaining({
          method: PELAGUS_GET_CONFIG_METHOD,
          chainId: "0x3a98",
        }),
      })
    )
  })
})
