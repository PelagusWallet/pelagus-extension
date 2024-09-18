import { BigNumberish, LogParams } from "quais"
import { EtxParams } from "quais/lib/commonjs/providers/formatting"
import { QuaiTransactionStatus } from "../../chain/types"

export type QuaiTransactionDB = {
  to: string
  from: string
  hash: string
  chainId: number
  type: number | null
  data: string | null
  nonce: number | null
  status: QuaiTransactionStatus

  gasUsed?: bigint | null
  gasPrice: BigNumberish | null
  gasLimit: BigNumberish | null
  maxFeePerGas: BigNumberish | null
  maxPriorityFeePerGas: BigNumberish | null

  index: bigint
  value: BigNumberish | null
  blockHash: string | null
  blockNumber: number | null

  etxs: EtxParams[]
  logs: LogParams[]
}
