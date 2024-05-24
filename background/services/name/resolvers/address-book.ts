import { AddressOnNetwork, NameOnNetwork } from "../../../accounts"
import PreferenceService from "../../preferences"
import { NameResolver } from "../name-resolver"

export default function addressBookResolverFor(
  preferenceService: PreferenceService
): NameResolver<"tally-address-book"> {
  return {
    type: "tally-address-book",

    canAttemptNameResolution(): boolean {
      return true
    },
    canAttemptAddressResolution(): boolean {
      return true
    },

    async lookUpAddressForName(nameOnNetwork: NameOnNetwork) {
      return preferenceService.lookUpAddressForName(nameOnNetwork)
    },
    async lookUpNameForAddress(addressOnNetwork: AddressOnNetwork) {
      return preferenceService.lookUpNameForAddress(addressOnNetwork)
    },
  }
}
