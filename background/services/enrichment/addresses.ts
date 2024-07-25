import { AddressOnNetwork } from "../../accounts"
import ChainService from "../chain"
import NameService from "../name"
import { AddressOnNetworkAnnotation, EnrichedAddressOnNetwork } from "./types"
import { getExtendedZoneForAddress } from "../chain/utils"

// TODO look up whether contracts are verified on EtherScan
// TODO ABIs
export async function resolveAddressAnnotation(
  chainService: ChainService,
  nameService: NameService,
  addressOnNetwork: AddressOnNetwork
): Promise<AddressOnNetworkAnnotation> {
  const { address } = addressOnNetwork

  const prevShard = globalThis.main.GetShard()
  globalThis.main.SetShard(getExtendedZoneForAddress(address))

  const codeHex = await chainService.jsonRpcProvider.getCode(address)
  globalThis.main.SetShard(prevShard)

  const [balance, nameRecord] = await Promise.all([
    chainService.getLatestBaseAccountBalance(addressOnNetwork),
    nameService.lookUpName(addressOnNetwork),
  ])

  return {
    balance,
    nameRecord,
    hasCode: codeHex !== "0x",
    timestamp: Date.now(),
  }
}

export async function enrichAddressOnNetwork(
  chainService: ChainService,
  nameService: NameService,
  addressOnNetwork: AddressOnNetwork
): Promise<EnrichedAddressOnNetwork> {
  return {
    ...addressOnNetwork,
    annotation: await resolveAddressAnnotation(
      chainService,
      nameService,
      addressOnNetwork
    ),
  }
}
