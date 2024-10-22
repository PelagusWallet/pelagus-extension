import {
  QiTransactionDB,
  TransactionStatus,
  UtxoActivityType,
} from "../../services/transactions/types"
import { ACTIVITIES_MAX_COUNT, UtxoActivities } from "../activities"

export const utxoActivityTypeHandle = (type: UtxoActivityType) => {
  switch (type) {
    case UtxoActivityType.RECEIVE:
      return "Receive"
    case UtxoActivityType.SEND:
      return "Send"
    case UtxoActivityType.CONVERT:
      return "Convert"
    default:
      return ""
  }
}

export const utxoActivityStatusHandle = (status: TransactionStatus) => {
  switch (status) {
    case TransactionStatus.CONFIRMED:
      return "Confirmed"
    case TransactionStatus.FAILED:
      return "Failed"
    case TransactionStatus.PENDING:
      return "Pending..."
    default:
      return ""
  }
}

export const utxoActivityAmountHandle = (
  amount: number,
  type: UtxoActivityType
) => {
  switch (type) {
    case UtxoActivityType.RECEIVE:
      return `+${amount}`
    case UtxoActivityType.SEND:
      return `-${amount}`
    case UtxoActivityType.CONVERT:
      return `${amount}`
    default:
      return ""
  }
}

export const utxoActivityTimestampHandle = (blockTimestamp: number) => {
  const date = new Date(blockTimestamp)

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  const month = months[date.getMonth()]
  const dayOfMonth = date.getDate().toString().padStart(2, "0")
  const year = date.getFullYear()

  return `${month} ${dayOfMonth}, ${year} ${hours}:${minutes}:${seconds}`
}

export const initializeUtxoActivitiesFromTransactions = (
  transactions: QiTransactionDB[]
): UtxoActivities => {
  const utxoActivities: UtxoActivities = {}

  transactions.forEach((transaction) => {
    const { senderPaymentCode, receiverPaymentCode, chainId } = transaction
    const chainIdStr = chainId.toString()

    if (senderPaymentCode) {
      if (!utxoActivities[senderPaymentCode]) {
        utxoActivities[senderPaymentCode] = {}
      }
      if (!utxoActivities[senderPaymentCode][chainIdStr]) {
        utxoActivities[senderPaymentCode][chainIdStr] = []
      }

      if (
        utxoActivities[senderPaymentCode][chainIdStr].length >=
        ACTIVITIES_MAX_COUNT
      ) {
        const activityArr = utxoActivities[senderPaymentCode][chainIdStr]
        activityArr.push(transaction)
        activityArr.splice(0, ACTIVITIES_MAX_COUNT)
      } else {
        utxoActivities[senderPaymentCode][chainIdStr].push(transaction)
      }
    }

    if (receiverPaymentCode) {
      if (!utxoActivities[receiverPaymentCode]) {
        utxoActivities[receiverPaymentCode] = {}
      }
      if (!utxoActivities[receiverPaymentCode][chainIdStr]) {
        utxoActivities[receiverPaymentCode][chainIdStr] = []
      }

      if (
        utxoActivities[receiverPaymentCode][chainIdStr].length >=
        ACTIVITIES_MAX_COUNT
      ) {
        const activityArr = utxoActivities[receiverPaymentCode][chainIdStr]
        activityArr.push(transaction)
        activityArr.splice(0, ACTIVITIES_MAX_COUNT)
      } else {
        utxoActivities[receiverPaymentCode][chainIdStr].push(transaction)
      }
    }
  })

  return utxoActivities
}
