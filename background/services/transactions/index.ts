import {
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import { getZoneForAddress, QuaiTransaction, TransactionReceipt } from "quais"

import {
  quaiTransactionFromReceipt,
  quaiTransactionFromRequest,
  quaiTransactionFromResponse,
} from "./utils"
import BaseService from "../base"
import ChainService from "../chain"
import KeyringService from "../keyring"
import { QuaiTransactionDB } from "./types"
import { ServiceCreatorFunction } from "../types"
import { TransactionServiceEvents } from "./events"
import { QuaiTransactionStatus } from "../chain/types"
import { isSignerPrivateKeyType } from "../keyring/utils"
import { createTransactionsDataBase, TransactionsDatabase } from "./db"

export default class TransactionService extends BaseService<TransactionServiceEvents> {
  static create: ServiceCreatorFunction<
    TransactionServiceEvents,
    TransactionService,
    [Promise<ChainService>, Promise<KeyringService>]
  > = async (chainService, keyringService) => {
    return new this(
      createTransactionsDataBase(),
      await chainService,
      await keyringService
    )
  }

  private constructor(
    private db: TransactionsDatabase,
    private chainService: ChainService,
    private keyringService: KeyringService
  ) {
    super()
  }

  override async internalStartService(): Promise<void> {
    await super.internalStartService()
    await this.initializeTransactions()
    this.checkPendingTransactions()
  }

  // ------------------------------------ public methods ------------------------------------
  public async signAndSendQuaiTransaction(
    request: QuaiTransactionRequest
  ): Promise<void> {
    try {
      const { jsonRpcProvider } = this.chainService
      let transactionResponse: QuaiTransactionResponse

      const fromAddress = request.from.toString()
      const signerWithType = await this.keyringService.getSigner(fromAddress)

      if (isSignerPrivateKeyType(signerWithType)) {
        transactionResponse = (await signerWithType.signer
          .connect(jsonRpcProvider)
          .sendTransaction(request)) as QuaiTransactionResponse
      } else {
        signerWithType.signer.connect(jsonRpcProvider)
        transactionResponse = (await signerWithType.signer.sendTransaction(
          request
        )) as QuaiTransactionResponse
      }

      const transaction = quaiTransactionFromResponse(
        transactionResponse,
        QuaiTransactionStatus.PENDING
      )
      await this.saveTransaction(transaction)
      await this.emitter.emit("transactionSend", transactionResponse.hash)

      this.subscribeToTransactionConfirmation(transactionResponse.hash)
    } catch (error) {
      const transaction = quaiTransactionFromRequest(
        request,
        QuaiTransactionStatus.FAILED
      )
      await this.saveTransaction(transaction)
      await this.emitter.emit("transactionSendFailure")
    }
  }

  public async removeActivities(address: string): Promise<void> {
    await this.db.deleteQuaiTransactionsByAddress(address)
  }

  public async sendQuaiTransaction(
    quaiTransaction: QuaiTransaction
  ): Promise<void> {
    try {
      const { jsonRpcProvider } = this.chainService
      const { to, serialized: signedTransaction } = quaiTransaction

      if (!to) {
        throw new Error("Transaction 'to' field is not specified.")
      }

      const zone = getZoneForAddress(to)
      if (!zone) {
        throw new Error(
          "Invalid address shard: Unable to determine the zone for the given 'to' address."
        )
      }

      const transactionResponse = (await jsonRpcProvider.broadcastTransaction(
        zone,
        signedTransaction
      )) as QuaiTransactionResponse

      const transaction = quaiTransactionFromResponse(
        transactionResponse,
        QuaiTransactionStatus.PENDING
      )
      await this.saveTransaction(transaction)
      await this.emitter.emit("transactionSend", transactionResponse.hash)

      this.subscribeToTransactionConfirmation(transactionResponse.hash)
    } catch (error) {
      const failedTransaction = quaiTransactionFromRequest(
        quaiTransaction,
        QuaiTransactionStatus.FAILED
      )
      await this.saveTransaction(failedTransaction)
      await this.emitter.emit("transactionSendFailure")
    }
  }

  // ------------------------------------ private methods ------------------------------------
  private async initializeTransactions(): Promise<void> {
    const transactions = await this.db.getAllQuaiTransactions()
    await this.emitter.emit("transactions", transactions)
  }

  private async checkPendingTransactions(): Promise<void> {
    const { jsonRpcProvider } = this.chainService

    const pendingTransactions = await this.db.getPendingQuaiTransactions()
    if (pendingTransactions.length <= 0) return

    await Promise.all(
      pendingTransactions.map(async ({ hash }) => {
        const receipt = await jsonRpcProvider.getTransactionReceipt(hash)
        if (receipt) {
          await this.updateTransactionWithReceipt(receipt)
        } else {
          await this.subscribeToTransactionConfirmation(hash)
        }
      })
    )
  }

  private async subscribeToTransactionConfirmation(
    hash: string
  ): Promise<void> {
    const { jsonRpcProvider } = this.chainService
    const receipt = await jsonRpcProvider.waitForTransaction(hash)
    if (!receipt) throw new Error("Transaction receipt is null")

    await this.updateTransactionWithReceipt(receipt)
  }

  private async saveTransaction(transaction: QuaiTransactionDB): Promise<void> {
    await this.db.addOrUpdateQuaiTransaction(transaction)
    // await this.emitter.emit("transaction", transaction)
  }

  private async updateTransactionWithReceipt(
    receipt: TransactionReceipt
  ): Promise<void> {
    const foundedTransaction = await this.db.getQuaiTransactionByHash(
      receipt.hash
    )
    if (!foundedTransaction) return

    const transaction = quaiTransactionFromReceipt(
      foundedTransaction,
      receipt,
      QuaiTransactionStatus.CONFIRMED
    )
    await this.db.addOrUpdateQuaiTransaction(transaction)
    // await this.emitter.emit("transaction", transaction)
  }
}
