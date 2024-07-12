import sinon from "sinon"
import {
  createChainService,
  createIndexingService,
  createNameService,
} from "../../../tests/factories"
import { QuaiNetworkGA } from "../../../constants/networks/networks"

describe("Enrichment Service Transactions", () => {
  const sandbox = sinon.createSandbox()

  beforeEach(async () => {
    sandbox.restore()
  })

  describe("annotationsFromLogs", () => {
    it("Should only create subannotations from logs with relevant addresses in them", async () => {
      const chainServicePromise = createChainService()
      const indexingServicePromise = createIndexingService({
        chainService: chainServicePromise,
      })
      const nameServicePromise = createNameService({
        chainService: chainServicePromise,
      })

      const [chainService, indexingService, nameService] = await Promise.all([
        chainServicePromise,
        indexingServicePromise,
        nameServicePromise,
      ])

      await chainService.startService()

      await chainService.addAccountToTrack({
        address: "0x9eef87f4c08d8934cb2a3309df4dec5635338115",
        network: QuaiNetworkGA,
      })

      await indexingService.addOrUpdateCustomAsset({
        contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        symbol: "USDC",
        name: "USDC Coin",
        decimals: 6,
        homeNetwork: QuaiNetworkGA,
      })

      await indexingService.addOrUpdateCustomAsset({
        contractAddress: "0x853d955aCEf822Db058eb8505911ED77F175b99e",
        symbol: "FRAX",
        name: "FRAX Token",
        decimals: 18,
        homeNetwork: QuaiNetworkGA,
      })
    })
  })
})
