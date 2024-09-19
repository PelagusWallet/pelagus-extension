import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
import { ChainData, Slip44CoinType } from "./constants"
import { HexString, UNIXTime } from "./types"
import type { FungibleAsset } from "./assets"
import { NetworkInterface } from "./constants/networks/networkTypes"
import { QuaiTransactionDB } from "./services/transactions/types"

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
export type AnyNetwork = NetworkInterface

export type EIP1559Block = {
  hash: string
  parentHash: string
  difficulty: bigint
  blockHeight: number
  timestamp: UNIXTime
  baseFeePerGas: bigint
  network: NetworkInterface
}

// TODO-MIGRATION replace with quai block
export type AnyEVMBlock = EIP1559Block

/**
 * The estimated gas prices for including a transaction in the next block.
 *
 * The estimated prices include a percentage (confidence) that a transaction with
 * the given `baseFeePerGas` will be included in the next block.
 */
export type BlockPrices = {
  network: NetworkInterface
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
  transactionRequest: QuaiTransactionRequest | QuaiTransactionDB
) =>
  !!transactionRequest?.maxFeePerGas ||
  !!transactionRequest?.maxPriorityFeePerGas
