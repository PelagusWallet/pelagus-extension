import {
  toBigInt,
  Interface,
  TransactionDescription,
  FunctionFragment,
  Fragment,
  EventFragment,
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

export const ERC20_FUNCTIONS = {
  allowance: FunctionFragment.from(
    "allowance(address owner, address spender) view returns (uint256)"
  ),
  approve: FunctionFragment.from(
    "approve(address spender, uint256 value) returns (bool)"
  ),
  balanceOf: FunctionFragment.from(
    "balanceOf(address owner) view returns (uint256)"
  ),
  decimals: FunctionFragment.from("decimals() view returns (uint8)"),
  name: FunctionFragment.from("name() view returns (string)"),
  symbol: FunctionFragment.from("symbol() view returns (string)"),
  totalSupply: FunctionFragment.from("totalSupply() view returns (uint256)"),
  transfer: FunctionFragment.from(
    "transfer(address to, uint amount) returns (bool)"
  ),
  transferFrom: FunctionFragment.from(
    "transferFrom(address from, address to, uint amount) returns (bool)"
  ),
  crossChainTransfer: FunctionFragment.from(
    "crossChainTransfer(address to, uint256 amount, uint256 gasLimit, uint256 minerTip, uint256 baseFee)"
  ),
}

const ERC20_EVENTS = {
  Transfer: EventFragment.from(
    "Transfer(address indexed from, address indexed to, uint amount)"
  ),
  Approval: EventFragment.from(
    "Approval(address indexed owner, address indexed spender, uint amount)"
  ),
}

export const ERC20_ABI = Object.values<Fragment>(ERC20_FUNCTIONS).concat(
  Object.values(ERC20_EVENTS)
)

export const ERC20_INTERFACE = new Interface(ERC20_ABI)

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
  const token = new Contract(
    tokenSmartContract.contractAddress,
    ERC20_INTERFACE,
    provider
  )

  try {
    const [symbol, name, decimals] = await Promise.all(
      [
        ERC20_FUNCTIONS.symbol,
        ERC20_FUNCTIONS.name,
        ERC20_FUNCTIONS.decimals,
      ].map(({ name: functionName }) => token.functionName.staticCall())
    )

    return {
      ...tokenSmartContract,
      symbol,
      name,
      decimals,
    }
  } catch (error) {
    logger.warn("Invalid metadata for token", tokenSmartContract)
    throw new Error("Could not retrieve erc20 token metadata")
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

export const getTokenBalances = async (
  { address, network }: AddressOnNetwork,
  tokenAddresses: HexString[],
  provider: JsonRpcProvider
): Promise<SmartContractAmount[]> => {
  let multicallAddress =
    CHAIN_SPECIFIC_MULTICALL_CONTRACT_ADDRESSES[network.chainID] ||
    MULTICALL_CONTRACT_ADDRESS
  if (isQuaiHandle(network)) {
    multicallAddress = ShardToMulticall(
      getExtendedZoneForAddress(address),
      network
    )
  }

  const contract = new Contract(multicallAddress, MULTICALL_INTERFACE, provider)
  const balanceOfCallData = ERC20_INTERFACE.encodeFunctionData("balanceOf", [
    address,
  ])

  const response = (await contract.tryBlockAndAggregate.staticCall(
    false, // false === don't require all calls to succeed
    tokenAddresses.map((tokenAddress) =>
      tokenAddress &&
      getExtendedZoneForAddress(address, false) ===
        getExtendedZoneForAddress(tokenAddress, false)
        ? [tokenAddress, balanceOfCallData]
        : []
    )
  )) as AggregateContractResponse

  return response.returnData.flatMap((data, i) => {
    if (!data.success) return []
    if (data.returnData === "0x00" || data.returnData === "0x") return []

    return {
      amount: toBigInt(data.returnData),
      smartContract: {
        contractAddress: tokenAddresses[i],
        homeNetwork: network,
      },
    }
  })
}
