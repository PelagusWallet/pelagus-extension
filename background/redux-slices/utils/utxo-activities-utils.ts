export type UtxoActivity = {
  id: string
  status: UtxoActivityStatus
  type: UtxoActivityType
  amount: string
  from: string
  to: string
  nonce: string
  total: string
  gasPrice: string
  gasLimit: string
  timestamp: number
  txHash: string
  chainID: string
}

export enum UtxoActivityStatus {
  PENDING = "Pending",
  CONFIRMED = "Confirmed",
  FAILED = "Failed",
}

export enum UtxoActivityType {
  RECEIVE = "Receive",
  SEND = "Send",
  CONVERT = "Convert",
}
