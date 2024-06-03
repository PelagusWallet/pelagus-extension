import { Deferrable } from "@ethersproject/properties"
import {
  JsonRpcSigner,
  TransactionRequest,
  TransactionResponse,
  Web3Provider,
} from "@ethersproject/providers"
import { AccessList } from "@ethersproject/transactions"
import { encodeJSON } from "./lib/utils"
import { toHexChainID, EVMNetwork } from "./networks"
import { TransactionAnnotation } from "./services/enrichment"

interface PelagusInternalJsonRpcSigner extends JsonRpcSigner {
  sendTransaction(
    transaction: Deferrable<
      TransactionRequest & { annotation?: TransactionAnnotation }
    >
  ): Promise<TransactionResponse>
}

export default class PelagusWeb3Provider extends Web3Provider {
  switchChain(network: EVMNetwork): Promise<unknown> {
    return this.send("wallet_switchEthereumChain", [
      {
        chainId: toHexChainID(network.chainID),
      },
    ])
  }

  override getSigner(
    addressOrIndex?: string | number
  ): PelagusInternalJsonRpcSigner {
    return super.getSigner(addressOrIndex)
  }

  static override hexlifyTransaction(
    transaction: TransactionRequest & { annotation?: TransactionAnnotation },
    allowExtra?: { [key: string]: boolean }
  ): { [key: string]: string | AccessList } {
    const { annotation, ...transactionRequest } = transaction
    return {
      ...Web3Provider.hexlifyTransaction(transactionRequest, allowExtra),
      annotation: encodeJSON(annotation),
    }
  }
}
