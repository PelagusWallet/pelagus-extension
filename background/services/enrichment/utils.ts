import dayjs from "dayjs"
import { getShardFromAddress } from "quais/lib/utils"
import { EIP2612SignTypedDataAnnotation, EnrichedEVMTransaction } from "./types"
import { ETHEREUM } from "../../constants"
import { SmartContractFungibleAsset } from "../../assets"
import NameService from "../name"
import { EIP712TypedData, HexString } from "../../types"
import { EIP2612TypedData } from "../../utils/signing"
import { ERC20TransferLog } from "../../lib/erc20"
import { normalizeEVMAddress, sameEVMAddress } from "../../lib/utils"
import { AddressOnNetwork } from "../../accounts"

export function isEIP2612TypedData(
  typedData: EIP712TypedData
): typedData is EIP2612TypedData {
  if (typeof typedData.message.spender === "string") {
    if (
      // Must be on main chain
      typedData.domain.chainId === Number(ETHEREUM.chainID) &&
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
  nameService: NameService,
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

  const [sourceName, ownerName, spenderName] = (
    await Promise.all([
      await nameService.lookUpName({
        address: spender,
        network: ETHEREUM,
      }),
      await nameService.lookUpName(
        { address: owner, network: ETHEREUM },
        false
      ),
      await nameService.lookUpName(
        { address: spender, network: ETHEREUM },
        false
      ),
    ])
  ).map((nameOnNetwork) => nameOnNetwork?.resolved?.nameOnNetwork.name)

  return {
    type: "EIP-2612",
    source: sourceName ?? spender,
    displayFields: {
      owner: ownerName ?? owner,
      spender: spenderName ?? spender,
      tokenContract: domain.verifyingContract || "unknown",
      value: formattedValue,
      ...(token ? { token } : {}),
      nonce,
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
      relevantAddresses.has(normalizeEVMAddress(log.recipientAddress)) ||
      relevantAddresses.has(normalizeEVMAddress(log.senderAddress))
  )
}

export function getRecipient(transaction: EnrichedEVMTransaction): {
  address?: HexString
  name?: string
} {
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
        address: transaction.to,
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
      return { address: transaction.to }
  }
}

export function getSender(transaction: EnrichedEVMTransaction): {
  address?: HexString
  name?: string
} {
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
  transaction: EnrichedEVMTransaction,
  trackedAccounts: AddressOnNetwork[]
): string[] {
  const { address: recipientAddress } = getRecipient(transaction)
  const { address: senderAddress } = getSender(transaction)

  if (!senderAddress) {
    return []
  }

  if (
    recipientAddress &&
    getShardFromAddress(senderAddress) === getShardFromAddress(recipientAddress)
  ) {
    // If sender and recipient are on the same shard, return both accounts
    const result = trackedAccounts
      .filter(
        ({ address }) =>
          sameEVMAddress(senderAddress, address) ||
          sameEVMAddress(recipientAddress, address)
      )
      .map(({ address }) => normalizeEVMAddress(address))
    return result
  }
  if (senderAddress === "0x0000000000000000000000000000000000000000") {
    // This is the ETX landing transaction, so return the recipient account
    const result = trackedAccounts
      .filter(({ address }) => sameEVMAddress(recipientAddress, address))
      .map(({ address }) => normalizeEVMAddress(address))
    return result
  }
  // If they are not on the same shard, only return the sender account
  const result = trackedAccounts
    .filter(({ address }) => sameEVMAddress(senderAddress, address))
    .map(({ address }) => normalizeEVMAddress(address))
  return result
}
