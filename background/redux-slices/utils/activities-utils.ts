import { BigNumberish, toBigInt } from "quais"
import { assetAmountToDesiredDecimals } from "../../assets"
import {
  convertToEth,
  isMaxUint256,
  sameQuaiAddress,
  weiToGwei,
} from "../../lib/utils"
import { isDefined } from "../../lib/utils/type-guards"
import { getRecipient, getSender } from "../../services/enrichment/utils"
import { HexString } from "../../types"
import {
  getExtendedZoneForAddress,
  getNetworkById,
} from "../../services/chain/utils"
import {
  EnrichedQuaiTransaction,
  QuaiTransactionDB,
} from "../../services/transactions/types"

export const INFINITE_VALUE = "infinite"

export type Activity = {
  status?: number
  type?: string
  to?: string
  recipient: { address?: HexString; name?: string }
  sender: { address?: HexString; name?: string }
  from: string
  blockHeight: number | null
  value: string
  nonce: number
  hash: string
  blockHash: string | null
  blockTimestamp?: number
  assetSymbol: string
  assetLogoUrl?: string
}

export type ActivityDetail = {
  assetIconUrl?: string
  label: string
  value: string | null | undefined
}

const ACTIVITY_DECIMALS = 2

function isEnrichedTransaction(
  transaction: QuaiTransactionDB | EnrichedQuaiTransaction
): transaction is EnrichedQuaiTransaction {
  return "annotation" in transaction
}

function getAmount(tx: EnrichedQuaiTransaction): string {
  const txNetwork = getNetworkById(tx?.chainId)

  if (!txNetwork)
    throw new Error("Failed find a tx network fot getting activity")
  const { value } = tx
  if (!value) return "(Unknown)"

  return `${convertToEth(value) || "0"} ${txNetwork.baseAsset.symbol}`
}

function getGweiPrice(value: bigint | null | undefined | BigNumberish): string {
  if (!value) return "(Unknown)"

  return `${weiToGwei(value) || "0"} Gwei`
}

function getTimestamp(blockTimestamp: number | undefined) {
  if (!blockTimestamp) {
    return "(Unknown)"
  }

  const date = new Date(blockTimestamp)

  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString()
  const dayOfMonth = date.getDate().toString()
  const year = date.getFullYear().toString().slice(-2)

  return `${hours}:${minutes} on ${month}/${dayOfMonth}/${year}`
}

const getAssetSymbol = (transaction: EnrichedQuaiTransaction) => {
  const txNetwork = getNetworkById(transaction?.chainId)

  if (!txNetwork)
    throw new Error("Failed find a tx network fot getting activity")

  const { annotation } = transaction

  switch (annotation?.type) {
    case "asset-transfer":
    case "asset-approval":
      return annotation.assetAmount.asset.symbol
    default:
      return txNetwork.baseAsset.symbol
  }
}

const getValue = (transaction: QuaiTransactionDB | EnrichedQuaiTransaction) => {
  const txNetwork = getNetworkById(transaction?.chainId)

  if (!txNetwork)
    throw new Error("Failed find a tx network fot getting activity")

  const { value } = transaction
  const localizedValue = assetAmountToDesiredDecimals(
    {
      asset: txNetwork.baseAsset,
      amount: toBigInt(value ?? 0),
    },
    ACTIVITY_DECIMALS
  ).toLocaleString("default", {
    maximumFractionDigits: ACTIVITY_DECIMALS,
  })

  if (isEnrichedTransaction(transaction)) {
    const { annotation } = transaction
    switch (annotation?.type) {
      case "asset-transfer":
        return annotation.assetAmount.localizedDecimalAmount
      case "asset-approval":
        return isMaxUint256(annotation.assetAmount.amount)
          ? INFINITE_VALUE
          : annotation.assetAmount.localizedDecimalAmount
      default:
        return localizedValue
    }
  }

  return localizedValue
}

const getAnnotationType = (transaction: QuaiTransactionDB) => {
  const { to, from } = transaction
  if (!to) return "contract-deployment"

  if (!from) return "contract-interaction"

  return getExtendedZoneForAddress(to, false) !==
    getExtendedZoneForAddress(from, false)
    ? "external-transfer"
    : "asset-transfer"
}

export const getActivity = (
  transaction: QuaiTransactionDB | EnrichedQuaiTransaction
): Activity => {
  const { to, from, nonce, hash, blockHash, chainId, blockNumber } = transaction

  const txNetwork = getNetworkById(chainId)

  if (!txNetwork)
    throw new Error("Failed find a tx network fot getting activity")

  let activity: Activity = {
    status: transaction?.status,
    to: to ?? "",
    from: from ?? "",
    recipient: { address: to ?? "" },
    sender: { address: from },
    blockHeight: blockNumber,
    assetSymbol: txNetwork?.baseAsset.symbol,
    nonce: nonce ?? 0,
    hash: hash ?? "",
    blockHash,
    value: getValue(transaction),
  }

  if (isEnrichedTransaction(transaction)) {
    const { annotation } = transaction

    activity = {
      ...activity,
      type: annotation?.type,
      value: getValue(transaction),
      blockTimestamp: annotation?.blockTimestamp,
      assetLogoUrl: annotation?.transactionLogoURL,
      assetSymbol: getAssetSymbol(transaction),
      recipient: getRecipient(transaction),
      sender: getSender(transaction),
    }

    return activity
  }
  const annotation = getAnnotationType(transaction)

  return {
    ...activity,
    type: annotation,
  }
}

export const sortActivities = (a: Activity, b: Activity): number => {
  if (
    a.blockHeight === null ||
    b.blockHeight === null ||
    a.blockHeight === b.blockHeight
  ) {
    // Sort dropped transactions after their corresponding successful ones.
    if (a.nonce === b.nonce) {
      if (a.blockHeight === null) {
        return 1
      }
      if (b.blockHeight === null) {
        return -1
      }
    }
    // Sort by nonce if a block height is missing or equal between two
    // transactions, as long as the two activities are on the same network;
    // otherwise, sort as before.
    return b.nonce - a.nonce
  }
  // null means pending or dropped, these are always sorted above everything
  // if networks don't match.
  if (a.blockHeight === null && b.blockHeight === null) {
    return 0
  }
  if (a.blockHeight === null) {
    return -1
  }
  if (b.blockHeight === null) {
    return 1
  }
  return b.blockHeight - a.blockHeight
}

export async function getActivityDetails(
  tx: EnrichedQuaiTransaction
): Promise<ActivityDetail[]> {
  const { annotation } = tx

  const assetTransfers =
    !annotation || !annotation?.subannotations
      ? []
      : annotation.subannotations
          .map((subannotation) => {
            if (
              subannotation.type === "asset-transfer" &&
              (sameQuaiAddress(subannotation.sender.address, tx.from) ||
                sameQuaiAddress(subannotation.recipient.address, tx.from))
            ) {
              return {
                direction: sameQuaiAddress(
                  subannotation.sender.address,
                  tx.from
                )
                  ? "out"
                  : "in",
                assetSymbol: subannotation.assetAmount.asset.symbol,
                assetLogoUrl: subannotation.assetAmount.asset.metadata?.logoURL,
                localizedDecimalAmount:
                  subannotation.assetAmount.localizedDecimalAmount,
              }
            }
            return undefined
          })
          .filter(isDefined)

  const {
    maxFeePerGas = null,
    gasPrice = null,
    nonce = null,
    hash,
    gasUsed,
    blockNumber,
  } = tx
  return [
    {
      label: "Block Height",
      value: blockNumber ? blockNumber.toString() : "(Unknown)",
    },
    { label: "Amount", value: getAmount(tx) ?? "" },
    { label: "Max Fee/Gas", value: getGweiPrice(maxFeePerGas) },
    { label: "Gas Price", value: getGweiPrice(gasPrice) },
    { label: "Gas", value: gasUsed ? gasUsed.toString() : "(Unknown)" },
    { label: "Nonce", value: String(nonce) },
    { label: "Timestamp", value: getTimestamp(annotation?.blockTimestamp) },
    { label: "Hash", value: hash },
  ].concat(
    assetTransfers.map((transfer) => {
      return {
        assetIconUrl: transfer.assetLogoUrl ?? "",
        label: transfer.assetSymbol,
        value:
          transfer.direction === "in"
            ? transfer.localizedDecimalAmount
            : `-${transfer.localizedDecimalAmount}`,
      }
    })
  )
}
