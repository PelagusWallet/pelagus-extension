import Dexie, { DexieOptions } from "dexie"
import { HexString } from "quais/lib/commonjs/utils"

import { UNIXTime } from "../../types"
import {
  QiReceiveAddressReservationReleaseReason,
  QiReceiveAddressReservationStatus,
  QiTransactionDB,
  QuaiTransactionDB,
  TransactionStatus,
} from "./types"

type AdditionalTransactionFieldsForDB = {
  dataSource: "local"
  firstSeen: UNIXTime
}

export type QuaiTransactionDBEntry = QuaiTransactionDB &
  AdditionalTransactionFieldsForDB

export type QiTransactionDBEntry = QiTransactionDB &
  AdditionalTransactionFieldsForDB

export type IntervalConversionDB = {
  id: string
  from: any
  to: any
  amount: string
  maxSlippage: number
  transactionCount: number
  intervalMinutes: number
  executedCount: number
  status: "running" | "completed" | "failed" | "cancelled"
  startedAt: UNIXTime
  completedAt?: UNIXTime
  error?: string
  transactions: string[]
}

export type QiReceiveAddressReservationDB = {
  origin: string
  reservationId: string
  account: number
  zone: string
  count: number
  addresses: string[]
  createdAt: UNIXTime
  lastAccessedAt: UNIXTime
  expiresAt: UNIXTime
  status: QiReceiveAddressReservationStatus
  committedAt?: UNIXTime
  releasedAt?: UNIXTime
  releaseReason?: QiReceiveAddressReservationReleaseReason | "lease-expired"
}

export class TransactionsDatabase extends Dexie {
  private quaiTransactions!: Dexie.Table<
    QuaiTransactionDBEntry,
    [string, string]
  >

  private qiTransactions!: Dexie.Table<QiTransactionDBEntry, [string, string]>

  private openedPaymentChannels!: Dexie.Table<{ paymentCode: string }, number>

  intervalConversions!: Dexie.Table<IntervalConversionDB, string>

  private qiReceiveAddressReservations!: Dexie.Table<
    QiReceiveAddressReservationDB,
    [string, string]
  >

  constructor(options?: DexieOptions) {
    super("pelagus/transactions", options)
    this.version(1).stores({
      migrations: null,
      quaiTransactions:
        "&[hash+chainId],hash,from,status,[from+chainId],to,[to+chainId],nonce,[nonce+from+chainId],blockHash,blockNumber,chainId,firstSeen,dataSource",
    })

    this.version(2).stores({
      qiTransactions:
        "&[hash+chainId],hash,from,status,[from+chainId],to,[to+chainId],nonce,[nonce+from+chainId],blockHash,blockNumber,chainId,timestamp,firstSeen,dataSource",
    })

    this.version(3).stores({
      openedPaymentChannels: "++id,paymentCode",
    })

    this.version(4).stores({
      quaiTransactions:
        "&[hash+chainId],hash,from,status,[from+chainId],to,[to+chainId],nonce,[nonce+from+chainId],blockHash,blockNumber,chainId,firstSeen,dataSource",
      qiTransactions:
        "&[hash+chainId],hash,from,status,[from+chainId],to,[to+chainId],nonce,[nonce+from+chainId],blockHash,blockNumber,chainId,timestamp,firstSeen,dataSource",
      openedPaymentChannels: "++id,paymentCode",
      intervalConversions: "&id,status,startedAt,from,to",
    })

    this.version(5).stores({
      qiReceiveAddressReservations:
        "&[origin+reservationId],origin,reservationId,status,expiresAt,[account+zone],[origin+status]",
    })

    // Explicitly map tables added after the original schema.
    this.intervalConversions = this.table("intervalConversions")
    this.qiReceiveAddressReservations = this.table(
      "qiReceiveAddressReservations"
    )
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
      .equals(TransactionStatus.PENDING)
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
      .equals(TransactionStatus.PENDING)
      .toArray()
  }

  async addOrUpdateQiTransaction(
    tx: QiTransactionDB,
    dataSource: QiTransactionDBEntry["dataSource"] = "local"
  ): Promise<void> {
    try {
      const existingTx = await this.getQiTransactionByHash(tx.hash)

      const blockNumber = existingTx?.blockNumber
        ? existingTx?.blockNumber
        : tx?.blockNumber

      await this.transaction("rw", this.qiTransactions, async () => {
        await this.qiTransactions.put({
          ...existingTx,
          ...tx,
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

  // ------------------------------------- payment channels -------------------------------------
  async addPaymentChannel(paymentCode: string): Promise<void> {
    await this.openedPaymentChannels.add({ paymentCode })
  }

  async getPaymentChannel(
    paymentCode: string
  ): Promise<{ paymentCode: string } | undefined> {
    return this.openedPaymentChannels
      .where("paymentCode")
      .equals(paymentCode)
      .first()
  }

  async getPaymentChannels(): Promise<{ paymentCode: string }[]> {
    return this.openedPaymentChannels.toArray()
  }

  // ------------------------------------- interval conversions -------------------------------------
  async addIntervalConversion(
    intervalConversion: IntervalConversionDB
  ): Promise<void> {
    await this.intervalConversions.add(intervalConversion)
  }

  async updateIntervalConversion(
    id: string,
    updates: Partial<IntervalConversionDB>
  ): Promise<void> {
    await this.intervalConversions.update(id, updates)
  }

  async getIntervalConversion(
    id: string
  ): Promise<IntervalConversionDB | undefined> {
    return this.intervalConversions.get(id)
  }

  async getAllIntervalConversions(): Promise<IntervalConversionDB[]> {
    return this.intervalConversions.toArray()
  }

  async getRunningIntervalConversions(): Promise<IntervalConversionDB[]> {
    return this.intervalConversions
      .where("status")
      .equals("running")
      .toArray()
  }

  // --------------------------- Qi receive reservations ---------------------------
  async getQiReceiveAddressReservation(
    origin: string,
    reservationId: string
  ): Promise<QiReceiveAddressReservationDB | undefined> {
    return this.qiReceiveAddressReservations.get([origin, reservationId])
  }

  async putQiReceiveAddressReservation(
    reservation: QiReceiveAddressReservationDB
  ): Promise<void> {
    await this.qiReceiveAddressReservations.put(reservation)
  }

  async getAllQiReceiveAddressReservations(): Promise<
    QiReceiveAddressReservationDB[]
  > {
    return this.qiReceiveAddressReservations.toArray()
  }

  async getUnreleasedQiReceiveAddressReservations(): Promise<
    QiReceiveAddressReservationDB[]
  > {
    return this.qiReceiveAddressReservations
      .where("status")
      .anyOf(["active", "committed"])
      .toArray()
  }

  async expireActiveQiReceiveAddressReservations(now: number): Promise<void> {
    await this.qiReceiveAddressReservations
      .where("status")
      .equals("active")
      .and((reservation) => reservation.expiresAt <= now)
      .modify({
        status: "released",
        releasedAt: now,
        releaseReason: "lease-expired",
      })
  }
}

export function initializeTransactionsDatabase(
  options?: DexieOptions
): TransactionsDatabase {
  console.log("Initializing transactions database")
  return new TransactionsDatabase(options)
}
