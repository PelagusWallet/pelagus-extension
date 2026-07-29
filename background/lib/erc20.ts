import {
  toBigInt,
  TransactionDescription,
  Contract,
  ContractRunner,
  JsonRpcProvider,
  LogParams,
} from "quais"
import logger from "./logger"
import {
  AggregateContractResponse,
  MULTICALL_CONTRACT_ADDRESS,
  MULTICALL_INTERFACE,
  CHAIN_SPECIFIC_MULTICALL_CONTRACT_ADDRESSES,
} from "../contracts/multicall"
import { HexString } from "../types"
import { ShardToMulticall } from "../constants"
import { SmartContract } from "../networks"
import { AddressOnNetwork } from "../accounts"
import { getExtendedZoneForAddress } from "../services/chain/utils"
import { SmartContractAmount, SmartContractFungibleAsset } from "../assets"
import { isQuaiHandle } from "../constants/networks/networkUtils"
import { ERC20_ABI, ERC20_EVENTS, ERC20_INTERFACE } from "../contracts/erc-20"

/*
 * Get an account's balance from an ERC20-compliant contract.
 */
export async function getBalance(
  provider: ContractRunner,
  tokenAddress: string,
  account: string
): Promise<bigint> {
  const token = new Contract(tokenAddress, ERC20_ABI, provider)
  return BigInt((await token.balanceOf(account)).toString())
}

/**
 * Returns the metadata for a single ERC20 token by calling the contract
 * directly. Certain providers may support more efficient lookup strategies.
 */
export async function getMetadata(
  provider: ContractRunner,
  tokenSmartContract: SmartContract
): Promise<SmartContractFungibleAsset> {
  try {
    const tokenContract = new Contract(
      tokenSmartContract.contractAddress,
      ERC20_INTERFACE,
      provider
    )

    const [name, symbol, decimals] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals(),
    ])

    return {
      ...tokenSmartContract,
      symbol,
      name,
      decimals,
    }
  } catch (error: any) {
    logger.warn(
      `Invalid metadata for token: ${tokenSmartContract.contractAddress}`
    )
    throw new Error(
      `Could not retrieve erc20 token metadata. ${error?.message || error}`
    )
  }
}

/**
 * Parses a contract input/data field as if it were an ERC20 transaction.
 * Returns the parsed data if parsing succeeds, otherwise returns `undefined`.
 */
export function parseERC20Tx(input: string): TransactionDescription | null {
  try {
    return ERC20_INTERFACE.parseTransaction({
      data: input,
    })
  } catch (err) {
    return null
  }
}

/**
 * Information bundle from an ostensible ERC20 transfer log using Pelagus types.
 */
export type ERC20TransferLog = {
  contractAddress: string
  amount: bigint
  senderAddress: HexString
  recipientAddress: HexString
}

/**
 * Parses the given list of EVM logs, returning information on any contained
 * ERC20 transfers.
 *
 * Note that the returned data should only be considered valid if the logs are
 * from a known asset address; this function does not check the asset address,
 * it only tries to blindly parse each log as if it were an ERC20 Transfer
 * event.
 *
 * @param logs An arbitrary list of EVMLogs, some of which may represent ERC20
 *        `Transfer` events.
 * @return Information on any logs that were parsable as ERC20 `Transfer`
 *         events. This does _not_ mean they are guaranteed to be ERC20
 *         `Transfer` events, simply that they can be parsed as such.
 */
export function parseLogsForERC20Transfers(
  logs: readonly LogParams[]
): ERC20TransferLog[] {
  return logs
    .map(({ address: contractAddress, data, topics }) => {
      try {
        const decoded = ERC20_INTERFACE.decodeEventLog(
          ERC20_EVENTS.Transfer,
          data,
          topics
        )

        if (
          typeof decoded.to === "undefined" ||
          typeof decoded.from === "undefined" ||
          typeof decoded.amount === "undefined"
        )
          return undefined

        return {
          contractAddress,
          amount: toBigInt(decoded.amount),
          senderAddress: decoded.from,
          recipientAddress: decoded.to,
        }
      } catch (_) {
        return undefined
      }
    })
    .filter((info): info is ERC20TransferLog => typeof info !== "undefined")
}

/**
 * Query token balances concurrently so JsonRpcProvider can coalesce the
 * individual quai_call payloads into a single JSON-RPC batch. Failed token
 * contracts are omitted without failing the other balance lookups.
 */
export const getTokenBalancesByRpcBatch = async (
  { address, network }: AddressOnNetwork,
  tokenAddresses: HexString[],
  provider: JsonRpcProvider
): Promise<SmartContractAmount[]> => {
  const results = await Promise.allSettled(
    tokenAddresses.map(async (contractAddress) => ({
      amount: await getBalance(provider, contractAddress, address),
      smartContract: {
        contractAddress,
        homeNetwork: network,
      },
    }))
  )

  return results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  )
}

export const getTokenBalances = async (
  { address, network }: AddressOnNetwork,
  tokenAddresses: HexString[],
  provider: JsonRpcProvider
): Promise<SmartContractAmount[]> => {
  // Determine shard from the token list (assumes all tokens in this batch share the same shard)
  const first = tokenAddresses.find((t) => !!t)
  if (!first) return []

  let multicallAddress =
    CHAIN_SPECIFIC_MULTICALL_CONTRACT_ADDRESSES[network.chainID] ||
    MULTICALL_CONTRACT_ADDRESS
  if (isQuaiHandle(network)) {
    multicallAddress = ShardToMulticall(
      getExtendedZoneForAddress(first),
      network
    )
  }

  if (!multicallAddress) {
    return getTokenBalancesByRpcBatch(
      { address, network },
      tokenAddresses,
      provider
    )
  }

  const contract = new Contract(multicallAddress, MULTICALL_INTERFACE, provider)
  const balanceOfCallData = ERC20_INTERFACE.encodeFunctionData("balanceOf", [
    address,
  ])

  // Filter to tokens on the same shard as the first token
  const filteredTokenAddresses = tokenAddresses.filter(
    (tokenAddress) =>
      getExtendedZoneForAddress(tokenAddress, false) ===
      getExtendedZoneForAddress(first, false)
  )

  const response = (await contract.tryBlockAndAggregate.staticCall(
    false, // false === don't require all calls to succeed
    filteredTokenAddresses.map((tokenAddress) => [tokenAddress, balanceOfCallData])
  )) as AggregateContractResponse

  return response.returnData.flatMap((data, i) => {
    if (!data.success) return []
    if (data.returnData === "0x00" || data.returnData === "0x") return []

    return {
      amount: toBigInt(data.returnData),
      smartContract: {
        contractAddress: filteredTokenAddresses[i],
        homeNetwork: network,
      },
    }
  })
}
