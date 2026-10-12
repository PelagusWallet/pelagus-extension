import { PermissionRequest } from "@pelagus-provider/provider-bridge-shared"
import {
  createInternalQuaiProviderService,
  createPreferenceService,
  createProviderBridgeService,
} from "../../../tests/factories"
import ProviderBridgeService from "../index"
import InternalQuaiProviderService from "../../internal-quai-provider"
import {
  QuaiMainnet,
  QuaiOrchardTestnet,
} from "../../../constants/networks/networks"

const ORIGIN = "https://app.test"
const ADDRESS = "0x0000000000000000000000000000000000000000"

describe("dApp permissions across a wallet network switch", () => {
  let service: ProviderBridgeService
  let internalQuaiProviderService: InternalQuaiProviderService

  beforeEach(async () => {
    const preferenceService = await createPreferenceService()
    await preferenceService.setSelectedAccount({
      address: ADDRESS,
      network: QuaiMainnet,
    })

    internalQuaiProviderService = await createInternalQuaiProviderService()
    service = await createProviderBridgeService({
      internalQuaiProviderService: Promise.resolve(internalQuaiProviderService),
      preferenceService: Promise.resolve(preferenceService),
    })
    await service.grantPermission({
      key: `${ORIGIN}_${ADDRESS}_9`,
      origin: ORIGIN,
      faviconUrl: "",
      title: "Test",
      state: "allow",
      accountAddress: ADDRESS,
      chainID: "9",
    } as PermissionRequest)

    // Connecting records the chain the dApp connected on.
    await internalQuaiProviderService.switchToSupportedNetwork(
      ORIGIN,
      QuaiMainnet
    )
  })

  it("keeps a connected dApp connected after the wallet changes network", async () => {
    // The dApp connected while the wallet was on mainnet, then the user
    // switched the wallet to Orchard. Its permission must survive: the user
    // approved this site for this account, not for one chain.
    await internalQuaiProviderService.setSelectedNetwork(QuaiOrchardTestnet)

    // The chain the dApp connected on, which is what permissions are keyed to.
    const { chainID } =
      await internalQuaiProviderService.getCurrentOrDefaultNetworkForOrigin(
        ORIGIN
      )

    // The invariant that protects the permission: the chain a dApp connected
    // on does not move when the wallet does.
    expect(chainID).toBe("9")
    await expect(
      service.checkPermission(ORIGIN, chainID)
    ).resolves.toBeDefined()

    // ...while what it is told about the chain follows the wallet.
    await expect(
      internalQuaiProviderService.routeSafeRPCRequest("eth_chainId", [], ORIGIN)
    ).resolves.toBe("0x3a98")
  })
})
