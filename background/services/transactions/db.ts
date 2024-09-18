import Dexie, { DexieOptions } from "dexie"

import { UNIXTime } from "../../types"
import { QuaiTransactionDB } from "./types"
import { QuaiTransactionStatus } from "../chain/types"

type AdditionalTransactionFieldsForDB = {
  dataSource: "local"
  firstSeen: UNIXTime
}

export type QuaiTransactionDBEntry = QuaiTransactionDB &
  AdditionalTransactionFieldsForDB

export class TransactionsDatabase extends Dexie {
  private quaiTransactions!: Dexie.Table<
    QuaiTransactionDBEntry,
    [string, string]
  >

  constructor(options?: DexieOptions) {
    super("pelagus/transactions", options)
    this.version(1).stores({
      migrations: null,
      quaiTransactions:
        "&[hash+chainId],hash,from,status,[from+chainId],to,[to+chainId],nonce,[nonce+from+chainId],blockHash,blockNumber,chainId,firstSeen,dataSource",
    })
  }

  async getAllQuaiTransactions(): Promise<QuaiTransactionDB[]> {
    return this.quaiTransactions.toArray()
  }

  async getQuaiTransactionByHash(
    txHash: string | null | undefined
  ): Promise<QuaiTransactionDBEntry | null> {
    if (!txHash) return null

    const transactions = await this.quaiTransactions
      .where("hash")
      .equals(txHash)
      .toArray()

    return transactions[0]
  }

  async getPendingQuaiTransactions(): Promise<QuaiTransactionDBEntry[] | []> {
    return this.quaiTransactions
      .where("status")
      .equals(QuaiTransactionStatus.PENDING)
      .toArray()
  }

  async addOrUpdateQuaiTransaction(
    tx: QuaiTransactionDB,
    dataSource: QuaiTransactionDBEntry["dataSource"] = "local"
  ): Promise<void> {
    try {
      const existingTx = await this.getQuaiTransactionByHash(tx.hash)

      const nonce = existingTx?.nonce ? existingTx?.nonce : tx?.nonce
      const blockNumber = existingTx?.blockNumber
        ? existingTx?.blockNumber
        : tx?.blockNumber

      await this.transaction("rw", this.quaiTransactions, async () => {
        await this.quaiTransactions.put({
          ...existingTx,
          ...tx,
          nonce,
          blockNumber,
          dataSource,
          firstSeen: existingTx?.firstSeen ?? Date.now(),
        })
      })
    } catch (error: any) {
      throw new Error(`Failed to add or update quai transaction: ${error}`)
    }
  }

  async deleteQuaiTransactionsByAddress(address: string): Promise<void> {
    const transactions = await this.getAllQuaiTransactions()
    const deletePromises = transactions.map(async () => {
      await this.quaiTransactions.where("from").equals(address).delete()
      await this.quaiTransactions.where("to").equals(address).delete()
    })
    await Promise.all(deletePromises)
  }
}

export function createTransactionsDataBase(
  options?: DexieOptions
): TransactionsDatabase {
  return new TransactionsDatabase(options)
}
