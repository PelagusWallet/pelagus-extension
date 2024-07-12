import { Transaction } from "@quais/transactions"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
import { ChainData, Slip44CoinType } from "./constants"
import { HexString, UNIXTime } from "./types"
import type { FungibleAsset } from "./assets"
import { NetworkInterfaceGA } from "./constants/networks/networkTypes"
import {
  ConfirmedQuaiTransaction,
  FailedQuaiTransaction,
  PendingQuaiTransaction,
} from "./services/chain/types"

/**
 * Each supported network family is generally incompatible with others from a
 * transaction, consensus, and/or wire format perspective.
 */
export type NetworkFamily = "EVM"

// Should be structurally compatible with FungibleAsset or much code will
// likely explode.
export type NetworkBaseAsset = FungibleAsset & {
  contractAddress?: string
  coinType?: Slip44CoinType
  chainID: string
}

/**
 * Represents a cryptocurrency network; these can potentially be L1 or L2.
 */
export type Network = {
  // Considered a primary key; two Networks should never share a name.
  name: string
  baseAsset: NetworkBaseAsset
  family: NetworkFamily
  chainID?: string
  derivationPath?: string
}

/**
 * Mixed in to any other type, gives it the property of belonging to a
 * particular network. Often used to delineate contracts or assets that are on
 * a single network to distinguish from other versions of them on different
 * networks.
 */
export type NetworkSpecific = {
  homeNetwork: AnyNetwork
}

/**
 * A smart contract on any network that tracks smart contracts via a hex
 * contract address.
 */
export type SmartContract = NetworkSpecific & {
  contractAddress: HexString
}

/**
 * An EVM-style network which *must* include a chainID.
 */
export type EVMNetwork = Network & {
  chainID: string
  family: "EVM"
  /**
   * Provided for custom networks
   */
  blockExplorerURL?: string
  chains?: ChainData[]
  isQuai?: boolean
}

export type ChainIdWithError = {
  chainId: string
  error: boolean
}

/**
 * Union type that allows narrowing to particular network subtypes.
 */
export type AnyNetwork = NetworkInterfaceGA

/**
 * An EVM-style block identifier, including difficulty, block height, and
 * self/parent hash data.
 */
export type EVMBlock = {
  hash: string
  parentHash: string
  difficulty: bigint
  blockHeight: number
  timestamp: UNIXTime
  network: NetworkInterfaceGA
}

/**
 * An EVM-style block identifier that includes the base fee, as per EIP-1559.
 */
export type EIP1559Block = EVMBlock & {
  baseFeePerGas: bigint
}

/**
 * A pre- or post-EIP1559 EVM-style block.
 */
export type AnyEVMBlock = EVMBlock | EIP1559Block

/**
 * Transaction types attributes are expanded in the https://eips.ethereum.org/EIPS/eip-2718 standard which
 * is backward compatible. This means that it's enough for us to expand only the accepted tx types.
 * On the other hand we have yet to find other types from the range being used, so let's be restrictive,
 * and we can expand the range afterward. Types we have encountered so far:
 * 0 - plain jane
 * 1 - EIP-2930
 * 2 - EIP-1559 transactions
 * 100 - EIP-2718 on Arbitrum
 */
export const KNOWN_TX_TYPES = [0, 1, 2, 100] as const
export type KnownTxTypes = typeof KNOWN_TX_TYPES[number]

/**
 * The estimated gas prices for including a transaction in the next block.
 *
 * The estimated prices include a percentage (confidence) that a transaction with
 * the given `baseFeePerGas` will be included in the next block.
 */
export type BlockPrices = {
  network: NetworkInterfaceGA
  blockNumber: number
  baseFeePerGas: bigint
  /**
   * A choice of gas price parameters with associated confidence that a
   * transaction using those parameters will be included in the next block.
   */
  estimatedPrices: BlockEstimate[]
  /**
   * Whether these prices were estimated locally or via a third party provider
   */
  dataSource: "local"
}

/**
 * An estimate of the confidence that a given set of gas price parameters
 * will result in the inclusion of a transaction in the next block.
 */
export type BlockEstimate = {
  confidence: number
  /**
   * For legacy (pre-EIP1559) transactions, the gas price that results in the
   * above likelihood of inclusion.
   */
  price?: bigint
  /**
   * For EIP1559 transactions, the max priority fee per gas that results in the
   * above likelihood of inclusion.
   */
  maxPriorityFeePerGas: bigint
  /**
   * For EIP1559 transactions, the max fee per gas that results in the above
   * likelihood of inclusion.
   */
  maxFeePerGas: bigint
}

/**
 * Tests whether two networks should be considered the same. Verifies family,
 * chainID, and name.
 */
export function sameNetwork(
  network1: AnyNetwork,
  network2: AnyNetwork
): boolean {
  return (
    network1.family === network2.family && network1.chainID === network2.chainID
  )
}

/**
 * Returns a 0x-prefixed hexadecimal representation of a number or string chainID
 * while also handling cases where an already hexlified chainID is passed in.
 */
export function toHexChainID(chainID: string | number): string {
  if (typeof chainID === "string" && chainID.startsWith("0x"))
    return chainID.toLowerCase()

  return `0x${BigInt(chainID).toString(16)}`
}

// There is probably some clever way to combine the following type guards into one function
export const isEIP1559TransactionRequest = (
  transactionRequest: // TODO-MIGRATION we don`t need this in future - remove
  | ConfirmedQuaiTransaction
    | PendingQuaiTransaction
    | FailedQuaiTransaction
    | QuaiTransactionRequest
): transactionRequest is QuaiTransactionRequest =>
  "maxFeePerGas" in transactionRequest &&
  transactionRequest.maxFeePerGas !== null &&
  "maxPriorityFeePerGas" in transactionRequest &&
  transactionRequest.maxPriorityFeePerGas !== null
