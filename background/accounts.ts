import { AnyAssetAmount } from "./assets"
import { HexString } from "./types"
import { NetworkInterface } from "./constants/networks/networkTypes"
import type { AccountSigner, ReadOnlyAccountSigner } from "./services/signing"

/**
 * An account balance at a particular time and block height, on a particular
 * network. Flexible enough to represent base assets like ETH as well
 * application-layer tokens like ERC-20s.
 */
export type AccountBalance = {
  /**
   * The address whose balance was measured.
   */
  address: HexString
  /**
   * The measured balance and the asset in which it's denominated.
   */
  assetAmount: AnyAssetAmount
  /**
   * The network on which the account balance was measured.
   */
  network: NetworkInterface
  /**
   * The block height at while the balance measurement is valid.
   */
  blockHeight?: bigint
  /**
   * When the account balance was measured, using Unix epoch timestamps.
   */
  retrievedAt: number
  /**
   * A loose attempt at tracking balance data provenance, in case providers
   * disagree and need to be disambiguated.
   */
  dataSource: "local"
}

export type QiWalletBalance = {
  paymentCode: HexString
  assetAmount: AnyAssetAmount
  network: NetworkInterface
  blockHeight?: bigint
  retrievedAt: number
  dataSource: "local"
}

/**
 * An address on a particular network. That's it. That's the comment.
 */
export type AddressOnNetwork = {
  address: HexString
  network: NetworkInterface
}

/**
 * A domain name, with a particular network.
 */
export type NameOnNetwork = {
  name: string
  network: NetworkInterface
}

export type AccountSignerWithId = Exclude<
  AccountSigner,
  typeof ReadOnlyAccountSigner
>

export type AccountSignerSettings = {
  signer: AccountSignerWithId
  title?: string
}
