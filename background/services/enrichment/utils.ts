import dayjs from "dayjs"
import { EIP2612SignTypedDataAnnotation } from "./types"
import { EIP712TypedData, HexString } from "../../types"
import { EIP2612TypedData } from "../../utils/signing"
import { ERC20TransferLog } from "../../lib/erc20"
import { sameQuaiAddress } from "../../lib/utils"
import { AddressOnNetwork } from "../../accounts"
import { SmartContractFungibleAsset } from "../../assets"
import { getExtendedZoneForAddress } from "../chain/utils"
import { EnrichedQuaiTransaction, QuaiTransactionState } from "../chain/types"

export function isEIP2612TypedData(
  typedData: EIP712TypedData
): typedData is EIP2612TypedData {
  if (typeof typedData.message.spender === "string") {
    if (
      // Must be on main chain
      typedData.primaryType === "Permit" &&
      // Must have all expected fields
      // @TODO use AJV validation
      ["owner", "spender", "value", "nonce", "deadline"].every(
        (key) => key in typedData.message
      )
    ) {
      return true
    }
  }
  return false
}

export async function enrichEIP2612SignTypedDataRequest(
  typedData: EIP2612TypedData,
  asset: SmartContractFungibleAsset | undefined
): Promise<EIP2612SignTypedDataAnnotation> {
  const { message, domain } = typedData
  const { value, owner, spender, nonce } = message

  // If we have a corresponding asset - use known decimals to display a human-friendly
  // amount e.g. 10 USDC.  Otherwise just display the value e.g. 10000000
  const formattedValue = asset
    ? `${Number(value) / 10 ** asset?.decimals} ${asset.symbol}`
    : `${value}`

  // We only need to add the token if we're not able to properly format the value above
  const token = formattedValue === `${value}` ? domain.name : null

  return {
    type: "EIP-2612",
    source: spender,
    displayFields: {
      owner,
      spender,
      tokenContract: domain.verifyingContract || "unknown",
      nonce,
      value: formattedValue,
      ...(token ? { token } : {}),
      expiry: dayjs.unix(Number(message.deadline)).format("DD MMM YYYY"),
    },
  }
}

export function getDistinctRecipentAddressesFromERC20Logs(
  logs: ERC20TransferLog[]
): string[] {
  return [...new Set([...logs.map(({ recipientAddress }) => recipientAddress)])]
}

export const getERC20LogsForAddresses = (
  logs: ERC20TransferLog[],
  addresses: string[]
): ERC20TransferLog[] => {
  const relevantAddresses = new Set(addresses)

  return logs.filter(
    (log) =>
      relevantAddresses.has(log.recipientAddress) ||
      relevantAddresses.has(log.senderAddress)
  )
}

export function getRecipient(
  transaction: QuaiTransactionState | EnrichedQuaiTransaction
): {
  address?: HexString
  name?: string
} {
  if (!("annotation" in transaction)) {
    return { address: transaction.from }
  }

  const { annotation } = transaction

  switch (annotation?.type) {
    case "asset-transfer":
      return {
        address: annotation.recipient?.address,
        name: annotation.recipient?.annotation.nameRecord?.resolved
          .nameOnNetwork.name,
      }
    case "contract-interaction":
      return {
        address: transaction.to ?? "",
        name: annotation.contractInfo?.annotation.nameRecord?.resolved
          .nameOnNetwork.name,
      }
    case "asset-approval":
      return {
        address: annotation.spender.address,
        name: annotation.spender.annotation?.nameRecord?.resolved.nameOnNetwork
          .name,
      }
    default:
      return { address: transaction.to ?? "" }
  }
}

export function getSender(
  transaction: QuaiTransactionState | EnrichedQuaiTransaction
): {
  address?: HexString
  name?: string
} {
  if (!("annotation" in transaction)) {
    return { address: transaction.from }
  }

  const { annotation } = transaction

  switch (annotation?.type) {
    case "asset-transfer":
      return {
        address: annotation.sender.address,
        name: annotation.sender?.annotation.nameRecord?.resolved.nameOnNetwork
          .name,
      }
    default:
      return { address: transaction.from }
  }
}

export function getRelevantTransactionAddresses(
  transaction: QuaiTransactionState | EnrichedQuaiTransaction,
  trackedAccounts: AddressOnNetwork[]
): string[] {
  const { address: recipientAddress } = getRecipient(transaction)
  const { address: senderAddress } = getSender(transaction)

  if (!senderAddress) return []

  if (
    recipientAddress &&
    getExtendedZoneForAddress(senderAddress, false) ===
      getExtendedZoneForAddress(recipientAddress, false)
  ) {
    // If sender and recipient are on the same shard, return both accounts
    const result = trackedAccounts
      .filter(({ address }) => {
        return (
          sameQuaiAddress(senderAddress, address) ||
          sameQuaiAddress(recipientAddress, address)
        )
      })
      .map(({ address }) => address)
    return result
  }
  if (senderAddress === "0x0000000000000000000000000000000000000000") {
    // This is the ETX landing transaction, so return the recipient account
    const result = trackedAccounts
      .filter(({ address }) => sameQuaiAddress(recipientAddress, address))
      .map(({ address }) => address)
    return result
  }
  // If they are not on the same shard, only return the sender account
  const result = trackedAccounts
    .filter(({ address }) => sameQuaiAddress(senderAddress, address))
    .map(({ address }) => address)
  return result
}
