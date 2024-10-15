import Dexie, { DexieOptions } from "dexie"
import { HexString } from "quais/lib/commonjs/utils"

import { UNIXTime } from "../../types"
import {
  QiTransactionDB,
  QuaiTransactionDB,
  QuaiTransactionStatus,
} from "./types"

type AdditionalTransactionFieldsForDB = {
  dataSource: "local"
  firstSeen: UNIXTime
}

export type QuaiTransactionDBEntry = QuaiTransactionDB &
  AdditionalTransactionFieldsForDB

export type QiTransactionDBEntry = QiTransactionDB &
  AdditionalTransactionFieldsForDB

export class TransactionsDatabase extends Dexie {
  private quaiTransactions!: Dexie.Table<
    QuaiTransactionDBEntry,
    [string, string]
  >

  private qiTransactions!: Dexie.Table<QiTransactionDBEntry, [string, string]>

  constructor(options?: DexieOptions) {
    super("pelagus/transactions", options)
    this.version(1).stores({
      migrations: null,
      quaiTransactions:
        "&[hash+chainId],hash,from,status,[from+chainId],to,[to+chainId],nonce,[nonce+from+chainId],blockHash,blockNumber,chainId,firstSeen,dataSource",
    })

    this.version(2).stores({
      qiTransactions:
        "&[hash+chainId],hash,from,status,[from+chainId],to,[to+chainId],nonce,[nonce+from+chainId],blockHash,blockNumber,chainId,firstSeen,dataSource",
    })
  }

  // ------------------------------------ quai tx ------------------------------------
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

  async getQuaiTransactionFirstSeen(txHash: HexString): Promise<number> {
    return (
      (await this.quaiTransactions.where("hash").equals(txHash).toArray())[0]
        .firstSeen || Date.now()
    )
  }

  // ------------------------------------- qi tx -------------------------------------
  async getAllQiTransactions(): Promise<QiTransactionDB[]> {
    return this.qiTransactions.toArray()
  }

  async getQiTransactionByHash(
    txHash: string | null | undefined
  ): Promise<QiTransactionDBEntry | null> {
    if (!txHash) return null

    const transactions = await this.qiTransactions
      .where("hash")
      .equals(txHash)
      .toArray()

    return transactions[0]
  }

  async getPendingQiTransactions(): Promise<QiTransactionDBEntry[] | []> {
    return this.qiTransactions
      .where("status")
      .equals(QuaiTransactionStatus.PENDING)
      .toArray()
  }

  async addOrUpdateQiTransaction(
    tx: QiTransactionDB,
    dataSource: QiTransactionDBEntry["dataSource"] = "local"
  ): Promise<void> {
    try {
      const existingTx = await this.getQiTransactionByHash(tx.hash)

      const nonce = existingTx?.nonce ? existingTx?.nonce : tx?.nonce
      const blockNumber = existingTx?.blockNumber
        ? existingTx?.blockNumber
        : tx?.blockNumber

      await this.transaction("rw", this.qiTransactions, async () => {
        await this.qiTransactions.put({
          ...existingTx,
          ...tx,
          nonce,
          blockNumber,
          dataSource,
          firstSeen: existingTx?.firstSeen ?? Date.now(),
        })
      })
    } catch (error: any) {
      throw new Error(`Failed to add or update qi transaction: ${error}`)
    }
  }

  async deleteQiTransactionsByAddress(address: string): Promise<void> {
    const transactions = await this.getAllQiTransactions()
    const deletePromises = transactions.map(async () => {
      await this.qiTransactions.where("from").equals(address).delete()
      await this.qiTransactions.where("to").equals(address).delete()
    })
    await Promise.all(deletePromises)
  }

  async getQiTransactionFirstSeen(txHash: HexString): Promise<number> {
    return (
      (await this.qiTransactions.where("hash").equals(txHash).toArray())[0]
        .firstSeen || Date.now()
    )
  }
}

export function initializeTransactionsDatabase(
  options?: DexieOptions
): TransactionsDatabase {
  return new TransactionsDatabase(options)
}
