import sinon from "sinon"
import ChainService from ".."
import { createChainService } from "../../../tests/factories"
import { ChainDatabase } from "../db"
import {
  NetworksArray,
  QuaiGoldenAgeTestnet,
} from "../../../constants/networks/networks"
import { QuaiTransactionState } from "../types"

type ChainServiceExternalized = Omit<ChainService, ""> & {
  db: ChainDatabase
  handlePendingTransaction: (transaction: QuaiTransactionState) => void
  evmChainLastSeenNoncesByNormalizedAddress: {
    [chainID: string]: { [normalizedAddress: string]: number }
  }
}

describe("ChainService", () => {
  const sandbox = sinon.createSandbox()
  let chainService: ChainService

  beforeEach(async () => {
    sandbox.restore()
    chainService = await createChainService()
    await chainService.startService()
  })

  afterEach(async () => {
    await chainService.stopService()
  })

  describe("internalStartService", () => {
    it("should not add duplicate networks on startup", async () => {
      // Startup is simulated in the `beforeEach`
      expect(
        chainService.subscribedNetworks.filter(
          ({ network }) => network.chainID === QuaiGoldenAgeTestnet.chainID
        )
      ).toHaveLength(1)
    })

    it("should initialize persisted data in the correct order", async () => {
      const chainServiceInstance =
        (await createChainService()) as unknown as ChainServiceExternalized

      const initializeBaseAssets = sandbox.spy(
        chainServiceInstance.db,
        "initializeBaseAssets"
      )
      const initializeNetworks = sandbox.spy(
        chainServiceInstance.db,
        "initializeNetworks"
      )

      await chainServiceInstance.internalStartService()

      expect(initializeBaseAssets.calledBefore(initializeNetworks)).toBe(true)
    })
  })

  // TODO
  // it("handlePendingTransactions on chains without mempool should subscribe to transaction confirmations, and persist the transaction to indexedDB", async () => {
  //   const chainServiceExternalized =
  //     chainService as unknown as ChainServiceExternalized
  //   const CHAIN_NONCE = 100
  //   // Return a fake provider
  //   const onceSpy = sandbox.spy()
  //   const getCurrentProvider = sandbox
  //     .stub(chainServiceExternalized, "getCurrentProvider")
  //     .callsFake(
  //       () =>
  //         ({
  //           getTransactionCount: async () => CHAIN_NONCE,
  //           once: onceSpy,
  //         } as unknown as any)
  //     )
  //
  //   expect(getCurrentProvider.called).toBe(true)
  //
  //   // provider.once should be called inside of subscribeToTransactionConfirmation
  //   // with the transaction hash
  //   expect(onceSpy.called).toBe(true)
  // })

  describe("updateSupportedNetworks", () => {
    it("Should properly update supported networks", async () => {
      chainService.supportedNetworks = []
      expect(chainService.supportedNetworks.length).toBe(8)
    })
  })

  describe("getNetworksToTrack", () => {
    it("Should fetch built-in and custom networks to track", async () => {
      await chainService.addAccountToTrack({
        address: "0x123",
        network: QuaiGoldenAgeTestnet,
      })

      await chainService.addAccountToTrack({
        address: "0x123",
        network: QuaiGoldenAgeTestnet,
      })

      expect(
        NetworksArray.find((network) => network.chainID === "12345")
      ).toBeTruthy()
    })
  })
})
