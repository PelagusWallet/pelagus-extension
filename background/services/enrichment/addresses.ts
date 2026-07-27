import { AccountBalance, AddressOnNetwork } from "../../accounts"
import ChainService from "../chain"
import NameService from "../name"
import { AddressOnNetworkAnnotation, EnrichedAddressOnNetwork } from "./types"
import { getExtendedZoneForAddress } from "../chain/utils"

interface AddressAnnotationHints {
  balance?: AccountBalance
  hasCode?: boolean
}

// TODO look up whether contracts are verified on EtherScan
// TODO ABIs
export async function resolveAddressAnnotation(
  chainService: ChainService,
  nameService: NameService,
  addressOnNetwork: AddressOnNetwork,
  hints: AddressAnnotationHints = {}
): Promise<AddressOnNetworkAnnotation> {
  const { address } = addressOnNetwork

  let hasCode = hints.hasCode
  if (typeof hasCode === "undefined") {
    const prevShard = globalThis.main.GetShard()
    globalThis.main.SetShard(getExtendedZoneForAddress(address))

    const codeHex = await chainService.jsonRpcProvider.getCode(address)
    globalThis.main.SetShard(prevShard)
    hasCode = codeHex !== "0x"
  }

  const nameRecord = await nameService.lookUpName(addressOnNetwork)

  return {
    ...(hints.balance ? { balance: hints.balance } : {}),
    nameRecord,
    hasCode,
    timestamp: Date.now(),
  }
}

export async function enrichAddressOnNetwork(
  chainService: ChainService,
  nameService: NameService,
  addressOnNetwork: AddressOnNetwork,
  hints?: AddressAnnotationHints
): Promise<EnrichedAddressOnNetwork> {
  return {
    ...addressOnNetwork,
    annotation: await resolveAddressAnnotation(
      chainService,
      nameService,
      addressOnNetwork,
      hints
    ),
  }
}
