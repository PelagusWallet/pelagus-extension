import ChainService from "../chain"
import IndexingService from "../indexing"
import NameService from "../name"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import BaseService from "../base"
import {
  EnrichedEVMTransactionSignatureRequest,
  SignTypedDataAnnotation,
  EnrichedSignTypedDataRequest,
} from "./types"
import { SignTypedDataRequest } from "../../utils/signing"
import { enrichEIP2612SignTypedDataRequest, isEIP2612TypedData } from "./utils"
import resolveTransactionAnnotation from "./transactions"
import {
  EnrichedQuaiTransaction,
  SerializedTransactionForHistory,
} from "../chain/types"
import { getNetworkById } from "../chain/utils"
import BlockService from "../block"
import { QuaiTransactionDB } from "../transactions/types"
import { QuaiTransactionDBEntry } from "../transactions/db"
import TransactionService from "../transactions"

export * from "./types"

interface Events extends ServiceLifecycleEvents {
  enrichedEVMTransaction: {
    transaction: EnrichedQuaiTransaction
    forAccounts: string[]
  }
  enrichedEVMTransactionSignatureRequest: EnrichedEVMTransactionSignatureRequest
  enrichedSignTypedDataRequest: EnrichedSignTypedDataRequest
}

/**
 * EnrichmentService is a coordinator service responsible for deciding when to
 * look up metadata about an application-level transaction, event, or address,
 * and annotating those entities for display UI.
 *
 * EnrichmentService acts primarily as a coordinator of ChainService,
 * IndexingService, and NameService to build annotations. It will need to
 * retrieve function selector and contract source code itself, but should
 * always prefer to delegate to a lower-lever service when possible.
 */
export default class EnrichmentService extends BaseService<Events> {
  /**
   * Create a new EnrichmentService. The service isn't initialized until
   * startService() is called and resolved.
   * @param indexingService - Required for token metadata and currency
   * @param chainService - Required for chain interactions.
   * @param nameService - Required for name lookups.
   * @returns A new, initializing EnrichmentService
   */
  static create: ServiceCreatorFunction<
    Events,
    EnrichmentService,
    [
      Promise<ChainService>,
      Promise<IndexingService>,
      Promise<NameService>,
      Promise<BlockService>,
      Promise<TransactionService>
    ]
  > = async (
    chainService,
    indexingService,
    nameService,
    blockService,
    transactionService
  ) => {
    return new this(
      await chainService,
      await indexingService,
      await nameService,
      await blockService,
      await transactionService
    )
  }

  private constructor(
    private chainService: ChainService,
    private indexingService: IndexingService,
    private nameService: NameService,
    private blockService: BlockService,
    private transactionService: TransactionService
  ) {
    super({})
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()
    await this.connectTransactionServiceEvents()
  }

  private async connectTransactionServiceEvents(): Promise<void> {
    this.transactionService.emitter.on(
      "updateQuaiTransaction",
      async ({ transaction, forAccounts }) => {
        const enrichedTransaction = await this.enrichTransaction(transaction, 2)

        this.emitter.emit("enrichedEVMTransaction", {
          transaction: enrichedTransaction,
          forAccounts,
        })
      }
    )
  }

  async enrichSignTypedDataRequest(
    signTypedDataRequest: SignTypedDataRequest
  ): Promise<EnrichedSignTypedDataRequest> {
    let annotation: SignTypedDataAnnotation | undefined

    const { typedData } = signTypedDataRequest
    if (isEIP2612TypedData(typedData)) {
      const correspondingAsset = undefined
      annotation = await enrichEIP2612SignTypedDataRequest(
        typedData,
        correspondingAsset
      )
    }

    const enrichedSignTypedDataRequest = {
      ...signTypedDataRequest,
      annotation,
    }

    this.emitter.emit(
      "enrichedSignTypedDataRequest",
      enrichedSignTypedDataRequest
    )

    return enrichedSignTypedDataRequest
  }

  async enrichTransaction(
    transaction: QuaiTransactionDB | QuaiTransactionDBEntry | null,
    desiredDecimals: number
  ): Promise<EnrichedQuaiTransaction> {
    const network = getNetworkById(transaction?.chainId)
    if (!network || !transaction)
      throw new Error("Failed find network or tx in enrichTransaction")

    return {
      ...transaction,
      annotation: await resolveTransactionAnnotation(
        this.blockService,
        this.chainService,
        this.indexingService,
        this.nameService,
        network,
        transaction,
        desiredDecimals
      ),
      network,
    }
  }
}
