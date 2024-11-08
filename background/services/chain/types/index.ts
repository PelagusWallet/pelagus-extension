import { QiAddressInfo } from "quais"
import { AddressOnNetwork, QiCoinbaseAddress } from "../../../accounts"
import { NetworkInterface } from "../../../constants/networks/networkTypes"

export type AddressCategory = {
  addresses: AddressOnNetwork[] | QiCoinbaseAddress[] | QiAddressInfo[]
  callback: (
    network: NetworkInterface,
    address: string,
    balance: bigint
  ) => Promise<void>
}
