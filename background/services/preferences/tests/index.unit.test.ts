import PreferenceService from ".."
import { QuaiGoldenAgeTestnet } from "../../../constants/networks/networks"

describe("Preference Service Unit", () => {
  let preferenceService: PreferenceService

  beforeEach(async () => {
    preferenceService = await PreferenceService.create()
    await preferenceService.startService()
  })

  afterEach(async () => {
    await preferenceService.stopService()
  })

  describe("addOrEditNameInAddressBook", () => {
    it("should emit an addressBookEntryModified event when called", async () => {
      const spy = jest.spyOn(preferenceService.emitter, "emit")
      const nameToAdd = {
        network: QuaiGoldenAgeTestnet,
        name: "foo",
        address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      }
      preferenceService.addOrEditNameInAddressBook(nameToAdd)

      expect(spy).toHaveBeenCalledWith("addressBookEntryModified", nameToAdd)
    })

    it("should correctly save entries and allow them to be queryable by name", async () => {
      preferenceService.addOrEditNameInAddressBook({
        network: QuaiGoldenAgeTestnet,
        name: "foo",
        address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      })

      const foundAddressOnNetwork = preferenceService.lookUpAddressForName({
        name: "foo",
        network: QuaiGoldenAgeTestnet,
      })

      expect(foundAddressOnNetwork?.address).toEqual(
        "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
      )
    })

    it("should correctly save entries and allow them to be queryable by address", async () => {
      preferenceService.addOrEditNameInAddressBook({
        network: QuaiGoldenAgeTestnet,
        name: "foo",
        address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      })

      const foundAddressOnNetwork = preferenceService.lookUpNameForAddress({
        address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
        network: QuaiGoldenAgeTestnet,
      })

      expect(foundAddressOnNetwork?.name).toEqual("foo")
    })
  })
})
