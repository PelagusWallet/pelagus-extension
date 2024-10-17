import {
  TransactionStatus,
  UtxoActivityType,
} from "../../services/transactions/types"

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
