import PreferenceService from ".."
import DEFAULT_PREFERENCES from "../defaults"
import { QuaiGoldenAgeTestnet } from "../../../constants/networks/networks"

describe("Preference Service Integration", () => {
  let preferenceService: PreferenceService

  beforeEach(async () => {
    preferenceService = await PreferenceService.create()
    await preferenceService.startService()
  })

  afterEach(async () => {
    await preferenceService.stopService()
  })

  describe("setSelectedAccount", () => {
    it("should correctly set selectedAccount in indexedDB", async () => {
      // Should match default account prior to interaction
      expect(await preferenceService.getSelectedAccount()).toEqual(
        DEFAULT_PREFERENCES.selectedAccount
      )
      const newAccount = {
        address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
        network: QuaiGoldenAgeTestnet,
      }
      await preferenceService.setSelectedAccount(newAccount)
      expect(await preferenceService.getSelectedAccount()).toEqual(newAccount)
    })
  })

  describe("setDefaultWalletValue", () => {
    it("should correctly toggle defaultWallet in indexedDB", async () => {
      // Should default to false
      expect(await preferenceService.getDefaultWallet()).toEqual(false)
      await preferenceService.setDefaultWalletValue(true)
      expect(await preferenceService.getDefaultWallet()).toEqual(true)
    })
  })
})
