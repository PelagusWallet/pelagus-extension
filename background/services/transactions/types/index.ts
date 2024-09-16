import { BigNumberish } from "quais"
import { QuaiTransactionStatus } from "../../chain/types"

export type QuaiTransactionDB = {
  to: string
  from: string
  chainId: number
  hash: string
  data: string | null
  gasLimit: BigNumberish | null
  maxFeePerGas: BigNumberish | null
  maxPriorityFeePerGas: BigNumberish | null
  nonce: number | null
  status: QuaiTransactionStatus
  type: number | null
  value: BigNumberish | null
  index: bigint
  blockNumber: number | null
  gasPrice: BigNumberish | null
  gasUsed?: bigint | null
}
