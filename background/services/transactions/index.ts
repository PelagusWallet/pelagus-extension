import {
  QiTransactionResponse,
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import {
  AddressStatus,
  Contract,
  denominations,
  getBytes,
  getZoneForAddress,
  isHexString,
  isQiAddress,
  parseQi,
  parseQuai,
  QiTransaction,
  QuaiTransaction,
  Shard,
  TransactionReceipt,
  TransactionResponse,
  Wallet,
  Zone,
} from "quais"

import { MAILBOX_INTERFACE } from "../../contracts/payment-channel-mailbox"
import BaseService from "../base"
import ChainService from "../chain"
import { QiOutpoint } from "../chain/db"
import logger from "../../lib/logger"
import KeyringService from "../keyring"
import { HexString } from "../../types"
import { MAILBOX_CONTRACT_ADDRESS, MINUTE, SECOND, VALID_ZONES, WRAPPED_QI_CONTRACT_ADDRESS, WRAPPED_QI_CONTRACT_ADDRESS_BYTES, WRAPPED_QUAI_CONTRACT_ADDRESS } from "../../constants"
import { QiTransactionDB, QuaiTransactionDB, TransactionStatus, UtxoActivityType } from "./types"
import { ServiceCreatorFunction } from "../types"
import { TransactionServiceEvents } from "./events"
import NotificationsManager from "../notifications"
import {
  getUniqueQiTransactionHashes,
  processReceivedQiTransaction,
  processConvertQiTransaction,
  processSentQiTransaction,
  quaiTransactionFromResponse,
  processFailedQiTransaction,
} from "./utils"
import { isSignerPrivateKeyType } from "../keyring/utils"
import { getRelevantTransactionAddresses } from "../enrichment/utils"
import { initializeTransactionsDatabase, TransactionsDatabase } from "./db"
import IndexingService from "../indexing"
import { isUtxoAccountTypeGuard } from "@pelagus/pelagus-ui/utils/accounts"
import {
  NormalizedQiSendToOutputsRequest,
  QiOutputRequest,
  QiSendToOutputsRequest,
} from "./types"

const TRANSACTION_CONFIRMATIONS = 1
const QI_TRANSACTIONS_FETCH_INTERVAL = 10 * SECOND
const TRANSACTION_RECEIPT_WAIT_TIMEOUT = 10 * MINUTE
const QI_DAPP_SEND_MAX_OUTPUTS = 128
const QI_RECEIVE_ADDRESS_MAX_COUNT = 32
const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)

const ZONE_ALIASES: Record<string, Zone> = {
  "0x00": Zone.Cyprus1,
  cyprus1: Zone.Cyprus1,
  "cyprus-1": Zone.Cyprus1,
  "zone-0-0": Zone.Cyprus1,
  "0x01": Zone.Cyprus2,
  cyprus2: Zone.Cyprus2,
  "cyprus-2": Zone.Cyprus2,
  "zone-0-1": Zone.Cyprus2,
  "0x02": Zone.Cyprus3,
  cyprus3: Zone.Cyprus3,
  "cyprus-3": Zone.Cyprus3,
  "zone-0-2": Zone.Cyprus3,
  "0x10": Zone.Paxos1,
  paxos1: Zone.Paxos1,
  "paxos-1": Zone.Paxos1,
  "zone-1-0": Zone.Paxos1,
  "0x11": Zone.Paxos2,
  paxos2: Zone.Paxos2,
  "paxos-2": Zone.Paxos2,
  "zone-1-1": Zone.Paxos2,
  "0x12": Zone.Paxos3,
  paxos3: Zone.Paxos3,
  "paxos-3": Zone.Paxos3,
  "zone-1-2": Zone.Paxos3,
  "0x20": Zone.Hydra1,
  hydra1: Zone.Hydra1,
  "hydra-1": Zone.Hydra1,
  "zone-2-0": Zone.Hydra1,
  "0x21": Zone.Hydra2,
  hydra2: Zone.Hydra2,
  "hydra-2": Zone.Hydra2,
  "zone-2-1": Zone.Hydra2,
  "0x22": Zone.Hydra3,
  hydra3: Zone.Hydra3,
  "hydra-3": Zone.Hydra3,
  "zone-2-2": Zone.Hydra3,
}

function normalizeQiZone(value: unknown, fallback?: Zone): Zone {
  if (value === undefined || value === null || value === "") {
    // Never silently pick a zone for signing/broadcasting flows — callers
    // that can tolerate a default must opt in to it explicitly.
    if (fallback) return fallback
    throw new Error('zone is required (e.g. "cyprus1")')
  }
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, "")
  const zone = ZONE_ALIASES[normalized]
  if (!zone) throw new Error(`Unsupported Qi zone: ${String(value)}`)
  return zone
}

function normalizePositiveQit(value: unknown, field: string): bigint {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${field} is required`)
  }
  // Reject types JS would silently coerce (booleans → 1n, arrays → element,
  // etc.); only accept an integer number, a bigint, or an integer string.
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "bigint"
  ) {
    throw new Error(`${field} must be an integer qit amount`)
  }
  if (
    typeof value === "number" &&
    (!Number.isInteger(value) || !Number.isSafeInteger(value))
  ) {
    throw new Error(`${field} must be an integer qit amount`)
  }
  if (
    typeof value === "string" &&
    !/^(0x[0-9a-fA-F]+|\d+)$/.test(value.trim())
  ) {
    throw new Error(`${field} must be an integer qit amount`)
  }
  let amount: bigint
  try {
    amount = BigInt(typeof value === "string" ? value.trim() : value)
  } catch {
    throw new Error(`${field} must be an integer qit amount`)
  }
  if (amount <= 0n) throw new Error(`${field} must be greater than 0`)
  return amount
}

function denominationValue(index: number): bigint {
  return BigInt(denominations[index])
}

function denominationIndexForQit(amount: bigint): number {
  return denominations.findIndex((denomination) => BigInt(denomination) === amount)
}

function normalizeDenomination(value: unknown, field: string): number {
  // Only accept an integer number or a decimal-digit string; reject the values
  // Number() would silently coerce ([] → 0, " " → 0, true → 1, "0x5" → 5).
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`${field} must be a Qi denomination index`)
  }
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    throw new Error(`${field} must be a Qi denomination index`)
  }
  const denomination = typeof value === "number" ? value : Number(value.trim())
  if (
    !Number.isInteger(denomination) ||
    denomination < 0 ||
    denomination >= denominations.length
  ) {
    throw new Error(`${field} must be a Qi denomination index`)
  }
  return denomination
}

function normalizeAccount(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0
  // Reject values Number() would silently coerce (arrays, booleans, hex, blank).
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("account must be a non-negative integer")
  }
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    throw new Error("account must be a non-negative integer")
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value) || !Number.isSafeInteger(value) || value < 0) {
      throw new Error("account must be a non-negative integer")
    }
    return value
  }

  const account = BigInt(value.trim())
  if (account > MAX_SAFE_INTEGER_BIGINT) {
    throw new Error("account must be a non-negative integer")
  }
  return Number(account)
}

function normalizeQiReceiveCount(value: unknown): number {
  if (value === undefined || value === null || value === "") return 1
  // Reject values Number() would silently coerce (arrays, booleans, hex, blank).
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(
      `count must be an integer between 1 and ${QI_RECEIVE_ADDRESS_MAX_COUNT}`
    )
  }
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    throw new Error(
      `count must be an integer between 1 and ${QI_RECEIVE_ADDRESS_MAX_COUNT}`
    )
  }
  const count = typeof value === "number" ? value : Number(value.trim())
  if (
    !Number.isInteger(count) ||
    count <= 0 ||
    count > QI_RECEIVE_ADDRESS_MAX_COUNT
  ) {
    throw new Error(
      `count must be an integer between 1 and ${QI_RECEIVE_ADDRESS_MAX_COUNT}`
    )
  }
  return count
}

function denominateQit(value: bigint): number[] {
  let remaining = value
  const out: number[] = []
  for (let i = denominations.length - 1; i >= 0; i -= 1) {
    const denomination = BigInt(denominations[i])
    while (remaining >= denomination) {
      out.push(i)
      remaining -= denomination
    }
  }
  if (remaining !== 0n) {
    throw new Error(`${value.toString()} qit cannot be represented as Qi denominations`)
  }
  return out
}

function toQuantity(value: number | bigint): string {
  return `0x${BigInt(value).toString(16)}`
}

function normalizeQiOutput(
  output: QiOutputRequest,
  index: number,
  zone: Zone
): { address: string; denomination: number } {
  if (!output || typeof output !== "object") {
    throw new Error(`outputs[${index}] must be an object`)
  }
  const address = String(output.address || "")
  if (!isQiAddress(address)) {
    throw new Error(`outputs[${index}].address must be a Qi address`)
  }
  const addressZone = getZoneForAddress(address)
  if (addressZone !== zone) {
    throw new Error(`outputs[${index}].address is not in the requested Qi zone`)
  }

  if (output.denomination !== undefined && output.denomination !== null && output.denomination !== "") {
    return {
      address,
      denomination: normalizeDenomination(output.denomination, `outputs[${index}].denomination`),
    }
  }

  const amountQit = normalizePositiveQit(
    output.amountQit ?? output.valueQit,
    `outputs[${index}].amountQit`
  )
  const denomination = denominationIndexForQit(amountQit)
  if (denomination < 0) {
    throw new Error(
      `outputs[${index}].amountQit must be one exact Qi denomination; split it into unique-address outputs`
    )
  }
  return { address, denomination }
}

function normalizeQiOutputsRequest(
  input: QiSendToOutputsRequest
): NormalizedQiSendToOutputsRequest {
  // Default to Cyprus1 when omitted: input UTXO selection is Cyprus1-only, so
  // this is the only zone a send can currently be built for.
  const zone = normalizeQiZone(input.zone, Zone.Cyprus1)
  // Guard against building an invalid cross-zone transaction: the wallet only
  // syncs/selects Cyprus1 outpoints today, so reject any zone the wallet is not
  // actually operating in (respects the VALID_ZONES migration gate).
  if (!VALID_ZONES.includes(zone)) {
    throw new Error(`Qi sends are not supported in zone ${String(input.zone)}`)
  }
  const rawOutputs =
    input.outputs || input.txOutputs || input.qiOutputs || input.qiEscrowOutputs
  if (!Array.isArray(rawOutputs) || rawOutputs.length === 0) {
    throw new Error("outputs is required and must contain at least one Qi output")
  }
  if (rawOutputs.length > QI_DAPP_SEND_MAX_OUTPUTS) {
    throw new Error(`outputs cannot contain more than ${QI_DAPP_SEND_MAX_OUTPUTS} entries`)
  }

  const outputs = rawOutputs.map((output, index) =>
    normalizeQiOutput(output, index, zone)
  )
  const seen = new Set<string>()
  for (const output of outputs) {
    if (seen.has(output.address)) {
      throw new Error(`Qi output address reused: ${output.address}`)
    }
    seen.add(output.address)
  }

  const amountQit = outputs
    .reduce((sum, output) => sum + denominationValue(output.denomination), 0n)
    .toString()

  return {
    outputs,
    amountQit,
    zone,
    account: normalizeAccount(input.account),
    data: input.data,
    origin: input.origin,
    label: input.label,
    tradeHash: input.tradeHash,
  }
}

/**
 * The `TransactionService` class is responsible for handling user transactions, including sending,
 * tracking, and updating transaction statuses. This service uses a database to save and
 * update transaction records and emits events to update the UI with the latest transaction statuses.
 *
 * Key functionalities include:
 * 1. Sending user transactions and emitting events upon transaction submission and updates.
 * 2. Maintaining its own database to store and manage transactions.
 * 3. Emitting all users' transactions on startup, and updating the UI upon transaction status changes.
 * 4. Subscribing to transactions once they are sent, and updating the transaction data with receipts upon confirmation.
 * 5. Fetching pending transactions from the database on startup and checking their status (confirmed or still pending).
 *    This ensures transactions are resubscribed to if the extension process is killed before transaction confirmation.
 */
export default class TransactionService extends BaseService<TransactionServiceEvents> {
  public readonly MAILBOX_CONTRACT_ADDRESS = MAILBOX_CONTRACT_ADDRESS || ""
  private intervalConversions: Map<string, NodeJS.Timeout> = new Map()
  private conversionMonitors: Map<string, () => void> = new Map()

  static create: ServiceCreatorFunction<
    TransactionServiceEvents,
    TransactionService,
    [Promise<ChainService>, Promise<KeyringService>, Promise<IndexingService>]
  > = async (chainService, keyringService, indexingService) => {
    return new this(
      initializeTransactionsDatabase(),
      await chainService,
      await keyringService,
      await indexingService
    )
  }

  private constructor(
    private db: TransactionsDatabase,
    private chainService: ChainService,
    private keyringService: KeyringService,
    private indexingService: IndexingService
  ) {
    super()
  }

  /**
   * Starts the TransactionService, initializes transactions, and checks for any pending transactions.
   * This ensures that all relevant transactions are being tracked and that the UI is up-to-date.
   */
  override async internalStartService(): Promise<void> {
    await super.internalStartService()

    this.checkPendingQiTransactions()
    this.checkPendingQuaiTransactions()

    // Await conversion recovery before initializing transactions to ensure
    // deterministic startup ordering and catch any errors.
    try {
      await this.recoverPendingConversions()
    } catch (error) {
      logger.error("Failed to recover pending conversions:", error)
    }

    await this.initializeQiTransactions()
    await this.initializeQuaiTransactions()

    // Restart any running interval conversions
    await this.restartRunningIntervals()
  }

  override async internalStopService(): Promise<void> {
    // Clean up any active conversion monitors
    for (const cleanup of this.conversionMonitors.values()) {
      try {
        cleanup()
      } catch (error) {
        logger.error("Error cleaning up conversion monitor:", error)
      }
    }
    this.conversionMonitors.clear()

    await super.internalStopService()
  }

  // ------------------------------------ public methods ------------------------------------
  /**
   * Signs and sends a new Quai transaction.
   * Emits an event when the transaction is successfully sent and stores the transaction in the database.
   * Subscribes to transaction confirmation to track the transaction status.
   *
   * @param {QuaiTransactionRequest} request - The transaction request data.
   * @returns {Promise<QuaiTransactionResponse | null>} - The response of the sent transaction or null in case of failure.
   */
  public async signAndSendQuaiTransaction(
    request: QuaiTransactionRequest
  ): Promise<QuaiTransactionResponse | null> {
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
      await this.processQuaiTransactionResponse(transactionResponse)
      return transactionResponse
    } catch (error: any) {
      logger.error(
        `Failed to sign and send Quai transaction: ${error?.message || error}`
      )
      this.emitter.emit("transactionSendFailure")
      return null
    }
  }

  /**
   * Broadcasts a signed Quai transaction to the network.
   * Emits an event when the transaction is successfully sent and stores the transaction in the database.
   * Subscribes to transaction confirmation to track the transaction status.
   *
   * @param {QuaiTransaction} quaiTransaction - The signed transaction to send.
   * @returns {Promise<void>} - Resolves when the transaction is sent.
   */
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
      await this.processQuaiTransactionResponse(transactionResponse)
    } catch (error: any) {
      logger.error(
        `Failed to send Quai transaction: ${error?.message || error}`
      )
      this.emitter.emit("transactionSendFailure")
    }
  }

  public async sendQiTransaction(
    amount: bigint,
    quaiAddress: string,
    senderPaymentCode: string,
    receiverPaymentCode: string
  ): Promise<string | undefined> {
    // DEBUG: Log service method invocation
    const serviceInvocationId = Date.now()
    console.log(`[TransactionService.sendQiTransaction] Invoked at ${serviceInvocationId}, amount: ${amount}`)

    let txHash: string | undefined = undefined
    let err: any | undefined = undefined
    try {
      const { jsonRpcProvider } = this.chainService
      let qiWallet = await this.keyringService.getQiHDWallet()
      qiWallet.connect(jsonRpcProvider)

      const maxAttempts = 3
      let attempts = 0
      let bufferPercentage = 10
      let transaction: QiTransactionDB | null = null
      while (attempts < maxAttempts) {
        try {
          const qiOutpoints = await this.chainService.getOutpointsForSending(
            amount,
            bufferPercentage
          )
          const outpointInfos = qiOutpoints.map((outpoint) => ({
            outpoint: outpoint.outpoint,
            address: outpoint.address,
            zone: Zone.Cyprus1,
            derivationPath: outpoint.derivationPath,
          }))

          qiWallet.importOutpoints(outpointInfos)

          if (!qiWallet.channelIsOpen(receiverPaymentCode)) {
            qiWallet.openChannel(receiverPaymentCode)
          }

          console.log(`[TransactionService.sendQiTransaction] Calling qiWallet.sendTransaction (attempt ${attempts + 1}, serviceId: ${serviceInvocationId})`)
          const tx = (await qiWallet.sendTransaction(
            receiverPaymentCode,
            amount,
            Zone.Cyprus1,
            Zone.Cyprus1
          )) as QiTransactionResponse
          txHash = tx?.hash
          console.log(`[TransactionService.sendQiTransaction] Transaction sent successfully! txHash: ${txHash}`)

          // Immediately remove the used outpoints from the database to prevent reuse
          // before the next sync completes (critical for interval conversions)
          await this.chainService.removeQiOutpoints(qiOutpoints)
          logger.info(`Removed ${qiOutpoints.length} spent outpoints from database after successful sendQiTransaction`)

          // Persist wallet state so address status changes (USED/ATTEMPTED_USE)
          // from the send flow are saved to disk
          await this.keyringService.vaultManager.add(
            { qiHDWallet: qiWallet.serialize() }, {}
          )

          const senderPaymentCode = qiWallet.getPaymentCode(0)

          transaction = processSentQiTransaction(
            senderPaymentCode,
            receiverPaymentCode,
            tx as QiTransactionResponse,
            amount
          )
          break
        } catch (error) {
          err = error
          if (
            error instanceof Error &&
            error.message.includes("Insufficient funds")
          ) {
            bufferPercentage += 10
          } else if (error instanceof Error && error.message.includes("non-existent UTXO")) {
            // Parse the error message to get the outpoint hash and index
            const match = error.message.match(/non-existent UTXO ([0-9a-fA-F]+):(\d+)/)
            if (match) {
              const outpointHash = match[1]
              const outpointIndex = parseInt(match[2], 10)
              
              // Remove the non-existent outpoint from the database
              const chainID = this.chainService.selectedNetwork.chainID
              const nonExistentOutpoint = {
                chainID,
                outpoint: {
                  txhash: outpointHash,
                  index: outpointIndex,
                  denomination: 0, // This doesn't matter for deletion
                  lock: 0 // This doesn't matter for deletion
                },
                value: BigInt(0), // This doesn't matter for deletion
                address: "", // This doesn't matter for deletion
                derivationPath: "" // This doesn't matter for deletion
              }
              await this.chainService.removeQiOutpoints([nonExistentOutpoint])
              logger.info(`Removed non-existent outpoint from database: ${outpointHash}:${outpointIndex}`)
            }
            // Continue to next attempt with fresh outpoints after removal
            qiWallet = await this.keyringService.getQiHDWallet()
            qiWallet.connect(jsonRpcProvider)
          } else {
            await this.chainService.syncQiWallet()
            qiWallet = await this.keyringService.getQiHDWallet()
            qiWallet.connect(jsonRpcProvider)
          }
          attempts++
        }
      }

      if (!transaction) {
        if (err) {
          throw err
        } else {
          throw new Error("Failed to send Qi transaction")
        }
      }

      // Wait for the transaction to be included in a block
      await Promise.all([
        this.saveQiTransaction(transaction),
        this.subscribeToQiTransaction(transaction.hash),
        this.chainService.syncQiWallet(),
      ])

      NotificationsManager.createSendQiTxNotification()
    } catch (error: any) {
      logger.error(`Failed to send Qi transaction: ${error?.message || error}`)

      const { chainID } = this.chainService.selectedNetwork
      const transaction = processFailedQiTransaction(
        senderPaymentCode,
        receiverPaymentCode,
        amount,
        chainID
      )
      await this.saveQiTransaction(transaction)
      NotificationsManager.createFailedQiTxNotification()
      throw error
    }

    try {
      const channelExists = await this.doesChannelExistForReceiver(
        senderPaymentCode,
        receiverPaymentCode
      )

      if (!channelExists) {
        await this.notifyQiRecipient(
          quaiAddress,
          senderPaymentCode,
          receiverPaymentCode
        )
      }
    } catch (error: any) {
      logger.error(`Failed to notify Qi recipient: ${error?.message || error}`)
    }
    return txHash
  }

  /**
   * Removes all Quai transaction activities associated with a specific address.
   *
   * @param {string} address - The address whose transaction activities will be removed.
   * @returns {Promise<void>} - Resolves once the activities are removed.
   */
  public async removeActivities(address: string): Promise<void> {
    await this.db.deleteQuaiTransactionsByAddress(address)
  }

  /**
   * Retrieves a Quai transaction from the database based on its hash.
   *
   * @param {HexString} txHash - The hash of the transaction to retrieve.
   * @returns {Promise<QuaiTransactionDB | null>} - The transaction details, or null if not found.
   */
  public async getQuaiTransaction(
    txHash: HexString
  ): Promise<QuaiTransactionDB | null> {
    return this.db.getQuaiTransactionByHash(txHash)
  }

  public async getTransactionFirstSeenFromDB(
    txHash: HexString
  ): Promise<number> {
    return this.db.getQuaiTransactionFirstSeen(txHash)
  }

  public async send(method: string, params: unknown[]): Promise<unknown> {
    return this.chainService.jsonRpcProvider.send(method, params)
  }

  public async getUnusedQiAddress(): Promise<string> {
    const qiWallet = await this.keyringService.getQiHDWallet()
    const gapAddresses = qiWallet.getGapAddressesForZone(Zone.Cyprus1)
    const coinbaseAddresses =
      await this.indexingService.getQiCoinbaseAddresses()

    const coinbaseAddressSet = new Set(
      coinbaseAddresses.map((addr) => addr.address)
    )
    const foundedAddress = gapAddresses.find(
      (gapAddress) => !coinbaseAddressSet.has(gapAddress.address)
    )

    let unusedAddress: string | null = null

    if (foundedAddress) {
      unusedAddress = foundedAddress.address
    } else {
      const maxAttempts = 2000
      let attempts = 0

      while (attempts < maxAttempts) {
        const { address } = await qiWallet.getNextAddress(0, Zone.Cyprus1)
        if (!coinbaseAddressSet.has(address)) {
          unusedAddress = address
          break
        }
        attempts++
      }

      if (!unusedAddress) {
        const errorMsg = "Maximum attempts reached without finding an unused address."
        logger.warn(errorMsg)
        throw new Error(errorMsg)
      }
    }
    return unusedAddress
  }

  public async getQiReceiveAddresses(input: {
    count?: unknown
    zone?: unknown
    account?: unknown
  } = {}): Promise<string[]> {
    const zone = normalizeQiZone(input.zone, Zone.Cyprus1)
    // The wallet only syncs/scans Cyprus1, so handing out receive addresses in
    // any other zone would produce funds the wallet can never see or spend.
    if (!VALID_ZONES.includes(zone)) {
      throw new Error(`Qi is not supported in zone ${String(input.zone)}`)
    }
    const count = normalizeQiReceiveCount(input.count)
    const account = normalizeAccount(input.account)

    // Public dapp-facing receive address requests are intentionally pinned to
    // account 0. Without a consent/rate-limit layer, arbitrary account indexes
    // let a permissioned origin grow the encrypted vault by looping accounts.
    if (account !== 0) {
      throw new Error("account must be 0")
    }

    const qiWallet = await this.keyringService.getQiHDWallet()
    const coinbaseAddresses = await this.indexingService.getQiCoinbaseAddresses()
    const excluded = new Set(coinbaseAddresses.map((addr) => addr.address))
    const { addresses, derivedCount } = this.reserveQiWalletAddresses(
      qiWallet,
      count,
      zone,
      account,
      "external",
      excluded
    )

    // Only rewrite the vault when new addresses were actually derived — a dapp
    // repeatedly requesting the same still-unused addresses shouldn't churn the
    // encrypted vault on every call.
    if (derivedCount > 0) {
      await this.keyringService.vaultManager.add(
        { qiHDWallet: qiWallet.serialize() },
        {}
      )
    }
    return addresses
  }

  public async sendQiToOutputs(
    input: QiSendToOutputsRequest
  ): Promise<string> {
    // normalizeQiOutputsRequest fully validates zone/outputs/account, so no
    // extra post-hoc checks are needed here.
    const request = normalizeQiOutputsRequest(input)

    const { jsonRpcProvider } = this.chainService
    const qiWallet = await this.keyringService.getQiHDWallet()
    qiWallet.connect(jsonRpcProvider)

    const amountQit = BigInt(request.amountQit)
    const outputAddresses = new Set(request.outputs.map((output) => output.address))
    let selectedOutpoints: QiOutpoint[] = []
    let feeQit = 0n
    let finalTx: QiTransaction | null = null

    // Phase 1: build, sign and broadcast. A failure here is a genuine send
    // failure and is surfaced to the caller.
    let response: QiTransactionResponse
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        selectedOutpoints = await this.chainService.getOutpointsForSending(
          amountQit + feeQit,
          10 + attempt * 10
        )
        qiWallet.importOutpoints(
          selectedOutpoints.map((outpoint) => ({
            outpoint: outpoint.outpoint,
            address: outpoint.address,
            zone: request.zone as Zone,
            derivationPath: outpoint.derivationPath,
          }))
        )

        const inputTotalQit = selectedOutpoints.reduce(
          (sum, outpoint) => sum + outpoint.value,
          0n
        )
        const changeQit = inputTotalQit - amountQit - feeQit
        if (changeQit < 0n) {
          throw new Error("Insufficient Qi inputs for outputs plus fee")
        }

        const inputAddresses = new Set(selectedOutpoints.map((outpoint) => outpoint.address))
        for (const outputAddress of outputAddresses) {
          if (inputAddresses.has(outputAddress)) {
            throw new Error(`Qi output address ${outputAddress} also appears in inputs`)
          }
        }

        const changeDenominations = denominateQit(changeQit)
        const { addresses: changeAddresses } = this.reserveQiWalletAddresses(
          qiWallet,
          changeDenominations.length,
          request.zone as Zone,
          request.account,
          "change",
          new Set([...outputAddresses, ...inputAddresses])
        )

        const tx = this.buildQiOutputsTransaction(
          qiWallet,
          selectedOutpoints,
          request.outputs,
          changeAddresses.map((address, index) => ({
            address,
            denomination: changeDenominations[index],
          })),
          request
        )

        const estimatedFee = await jsonRpcProvider.estimateFeeForQi(
          this.toQiFeeEstimationTx(tx)
        )
        const nextFeeQit =
          estimatedFee < 10n ? 10n : (BigInt(estimatedFee) * 11n) / 10n

        if (feeQit >= nextFeeQit) {
          finalTx = tx
          break
        }
        feeQit = nextFeeQit
      }

      if (!finalTx) throw new Error("Failed to build Qi transaction")

      const signedTx = await qiWallet.signTransaction(finalTx)
      response = (await jsonRpcProvider.broadcastTransaction(
        request.zone as Zone,
        signedTx
      )) as QiTransactionResponse
    } catch (error: any) {
      logger.error(`Failed to send Qi outputs: ${error?.message || error}`)
      // Persist any freshly derived change addresses and re-sync before
      // surfacing the failure so wallet state stays consistent.
      try {
        await this.keyringService.vaultManager.add(
          { qiHDWallet: qiWallet.serialize() },
          {}
        )
        await this.chainService.syncQiWallet()
      } catch (cleanupError: any) {
        logger.error(
          `Failed to persist Qi wallet after send failure: ${
            cleanupError?.message || cleanupError
          }`
        )
      }
      throw error
    }

    // Phase 2: the transaction is broadcast and on-chain. Bookkeeping failures
    // here must NOT reject the send — the caller (and any dapp) must still
    // receive the txHash so they don't retry and double-spend.
    const signedTransactionHash = response.hash
    try {
      await this.chainService.removeQiOutpoints(selectedOutpoints)
      await this.keyringService.vaultManager.add(
        { qiHDWallet: qiWallet.serialize() },
        {}
      )

      const transaction = processSentQiTransaction(
        qiWallet.getPaymentCode(0),
        request.outputs.length === 1
          ? request.outputs[0].address
          : `${request.outputs.length} Qi outputs`,
        response,
        amountQit
      )

      await Promise.all([
        this.saveQiTransaction(transaction),
        this.subscribeToQiTransaction(transaction.hash),
        this.chainService.syncQiWallet(),
      ])
      NotificationsManager.createSendQiTxNotification()
    } catch (bookkeepingError: any) {
      logger.error(
        `Qi send ${signedTransactionHash} broadcast but post-processing failed: ${
          bookkeepingError?.message || bookkeepingError
        }`
      )
    }
    return signedTransactionHash
  }

  public normalizeQiSendToOutputsRequest(
    input: QiSendToOutputsRequest
  ): NormalizedQiSendToOutputsRequest {
    return normalizeQiOutputsRequest(input)
  }

  private reserveQiWalletAddresses(
    qiWallet: any,
    count: number,
    zone: Zone,
    account: number,
    path: "external" | "change",
    exclude: Set<string> = new Set()
  ): { addresses: string[]; derivedCount: number } {
    if (count <= 0) return { addresses: [], derivedCount: 0 }

    const reserved: string[] = []
    const reservedSet = new Set<string>()
    const canTake = (address: string) =>
      !reservedSet.has(address) && !exclude.has(address)
    const take = (address: string) => {
      if (!canTake(address)) return
      reserved.push(address)
      reservedSet.add(address)
    }

    // Reuse already-derived, not-yet-used addresses first (for BOTH receive and
    // change) so repeated sends / qi_getReceiveAddresses calls don't advance the
    // derivation index without bound. This is critical: quais' restore/rescan
    // stops after `gapLimit` (5) consecutive unused addresses, so a run of
    // derived-but-unfunded addresses ahead of a funded one makes the funded
    // address (e.g. change) unrecoverable on restore.
    //
    // A freshly derived address has status UNKNOWN and only becomes UNUSED after
    // a sync confirms it, so we must treat UNKNOWN as reusable too — otherwise
    // (before the next sync) reuse never fires and every call derives afresh.
    // Reusing an as-yet-unmined change address across two sends is a minor
    // address-reuse tradeoff, far preferable to losing funds past the gap limit.
    const existing: Array<{
      address: string
      account: number
      status: string
    }> =
      path === "change"
        ? qiWallet.getChangeAddressesForZone(zone)
        : qiWallet.getAddressesForZone(zone)
    for (const info of existing) {
      if (reserved.length >= count) break
      if (info.account !== account) continue
      if (
        info.status !== AddressStatus.UNUSED &&
        info.status !== AddressStatus.UNKNOWN
      ) {
        continue
      }
      take(info.address)
    }

    // Derive fresh addresses (public API: advances the index and persists via
    // serialize()) for whatever the unused pool couldn't cover.
    let derivedCount = 0
    const maxDerivations = count - reserved.length + 50
    for (let i = 0; i < maxDerivations && reserved.length < count; i += 1) {
      const { address } =
        path === "change"
          ? qiWallet.getNextChangeAddressSync(account, zone)
          : qiWallet.getNextAddressSync(account, zone)
      derivedCount += 1
      take(address)
    }

    if (reserved.length < count) {
      throw new Error(`Unable to reserve ${count} Qi ${path} addresses`)
    }
    return { addresses: reserved, derivedCount }
  }

  private buildQiOutputsTransaction(
    qiWallet: any,
    selectedOutpoints: QiOutpoint[],
    outputs: NormalizedQiSendToOutputsRequest["outputs"],
    changeOutputs: NormalizedQiSendToOutputsRequest["outputs"],
    request: NormalizedQiSendToOutputsRequest
  ): QiTransaction {
    const tx = new QiTransaction()
    tx.type = 2
    tx.chainId = Number(this.chainService.selectedNetwork.chainID)
    tx.txInputs = selectedOutpoints.map((outpoint) => {
      const addressInfo = qiWallet.getAddressInfo(outpoint.address)
      if (!addressInfo?.pubKey) {
        throw new Error(`Missing public key for Qi input address ${outpoint.address}`)
      }
      return {
        txhash: outpoint.outpoint.txhash,
        index: outpoint.outpoint.index,
        pubkey: addressInfo.pubKey,
      }
    })
    tx.txOutputs = [...outputs, ...changeOutputs]
    if (request.data) {
      if (!isHexString(request.data)) {
        throw new Error("Qi transaction data must be a hex string")
      }
      tx.data = getBytes(request.data)
    }
    return tx
  }

  private toQiFeeEstimationTx(tx: QiTransaction): {
    txType: number
    txIn: Array<{
      previousOutpoint: { txHash: string; index: string }
      pubkey: string
    }>
    txOut: Array<{ address: string; denomination: string }>
  } {
    return {
      txType: 2,
      txIn: tx.txInputs.map((input) => ({
        previousOutpoint: {
          txHash: input.txhash,
          index: toQuantity(input.index),
        },
        pubkey: input.pubkey,
      })),
      txOut: tx.txOutputs.map((output) => ({
        address: output.address,
        denomination: toQuantity(output.denomination),
      })),
    }
  }

  public async convertQuaiToQi(
    from: string,
    value: string,
    maxSlippage: number
  ): Promise<void> {
    const amount = parseQuai(value)
    const unusedAddress = await this.getUnusedQiAddress()

    // Encode the slippage value in the transaction data
    let slippageData = encodeTwoBytesBigEndian(maxSlippage)

    // Convert to hex string format for the transaction
    const slippageDataHex = "0x" + Buffer.from(slippageData).toString("hex")

    const convertTxRequest = {
      to: unusedAddress,
      from,
      value: amount,
      gasLimit: 1000000, // use 1M gas limit to avoid running out of gas when creating outpoints
      data: slippageDataHex,
    }
    await this.signAndSendQuaiTransaction(convertTxRequest)
  }

  public async getUTXODenominationDistribution(): Promise<{ [denomination: number]: number }> {
    const qiOutpoints = await this.chainService.getQiOutpointsLessThanDenomination(
      denominations.length - 1,
      this.chainService.selectedNetwork.chainID,
      await this.chainService.jsonRpcProvider.getBlockNumber(Shard.Cyprus1)
    )

    const distribution = qiOutpoints.reduce((acc, outpoint) => {
      const denomination = outpoint.outpoint.denomination
      acc[denomination] = (acc[denomination] || 0) + 1
      return acc
    }, {} as { [denomination: number]: number })
    return distribution
  }

  public async aggregateQi(maxDenominationAggregate: number, maxDenominationOutput: number, onProgress?: (progress: number, step: string, detail?: string) => void): Promise<string> {
    const { jsonRpcProvider } = this.chainService
    let qiWallet = await this.keyringService.getQiHDWallet()
    qiWallet.connect(jsonRpcProvider)
    
    console.log("maxDenominationAggregate:", maxDenominationAggregate)
    console.log("maxDenominationOutput:", maxDenominationOutput)

    const maxInputs = 1000

    const qiOutpoints = await this.chainService.getQiOutpointsLessThanDenomination(
      maxDenominationAggregate+1, // +1 because we want to include the maxDenominationAggregate in the selection
      this.chainService.selectedNetwork.chainID,
      await this.chainService.jsonRpcProvider.getBlockNumber(Shard.Cyprus1)
    )

    const outpoints = qiOutpoints.slice(0, maxInputs)

    qiWallet.importOutpoints(outpoints.map((outpoint) => ({
      outpoint: outpoint.outpoint,
      address: outpoint.address,
      zone: Zone.Cyprus1,
      derivationPath: outpoint.derivationPath,
    })))
    const amount = outpoints.reduce((acc, outpoint) => acc + denominations[outpoint.outpoint.denomination], BigInt(0))

    const tx = await qiWallet.aggregate(Zone.Cyprus1, {}, maxDenominationAggregate, maxDenominationOutput, onProgress)
    console.log("tx", tx)
    try {
      const transaction = processSentQiTransaction(
        qiWallet.getPaymentCode(0),
        qiWallet.getPaymentCode(0),
        tx as QiTransactionResponse,
        amount
      )
      await this.saveQiTransaction(transaction)
      await this.subscribeToQiTransaction(transaction.hash)
    } catch (error: any) {
      console.log("error saving Qi aggregation transaction", error)
    }
    setTimeout(async () => {
      await this.chainService.syncQiWallet()
    }, 3000)
    return tx.hash
  }

  public async unwrapQi(value: string, from: string): Promise<string | undefined> {
    const { jsonRpcProvider } = this.chainService
    try {
    const amount = parseQuai(value)
    const unusedAddress = await this.getUnusedQiAddress()
    const signerWithType = await this.keyringService.getSigner(from)
    
    // Connect the signer to the provider
    // For Wallet (private key), connect() returns a new connected Wallet
    // For QuaiHDWallet, connect() returns void and modifies the instance
    let connectedSigner: any

    let tx: QuaiTransactionResponse | null = null
    if (isSignerPrivateKeyType(signerWithType)) {
      connectedSigner = signerWithType.signer.connect(jsonRpcProvider)
      const contract = new Contract(
        WRAPPED_QI_CONTRACT_ADDRESS,
        ["function unwrapQi(address,uint256,uint64)"],
        connectedSigner
      )
      tx = await contract.unwrapQi(unusedAddress, amount, 1000000, {
        gasLimit: 1100000, // 1.1M gas limit to avoid running out of gas when creating outpoints
      })
    } else {
      // For HD wallets, connect() returns void, so we connect in place
      signerWithType.signer.connect(jsonRpcProvider)
      connectedSigner = signerWithType.signer
      // For HD Wallet signers, we need to construct the transaction request
      const contract = new Contract(
        WRAPPED_QI_CONTRACT_ADDRESS,
        ["function unwrapQi(address,uint256,uint64)"],
        jsonRpcProvider
      )
      
      // Get the encoded function data
      const data = contract.interface.encodeFunctionData("unwrapQi", [unusedAddress, amount, 1000000])
      
      // Construct the transaction request
      const request = {
        to: WRAPPED_QI_CONTRACT_ADDRESS,
        from,
        data,
        gasLimit: 1100000, // 1.1M gas limit to avoid running out of gas when creating outpoints
      }
      
      tx = (await connectedSigner.sendTransaction(
        request, 
      )) as QuaiTransactionResponse
    }

    if (!tx) {
      throw new Error("Failed to send claim transaction")
    }
    console.log("claim tx", tx)
    await this.processQuaiTransactionResponse(tx)
    return tx.hash
  } catch (error: any) {
    logger.error("Failed to unwrap Qi", error.message)
    throw error
  }
  }

  public async wrapQi(value: string, to: string): Promise<string | undefined> {
    const { jsonRpcProvider } = this.chainService
    let qiWallet = await this.keyringService.getQiHDWallet()
    // QiHDWallet.connect() returns void and modifies the instance
    qiWallet.connect(jsonRpcProvider)
    const amount = parseQi(value)
    console.log("amount", amount)
    console.log("to", to)
    let transaction: QiTransactionDB | null = null
    let err: any | undefined = undefined
      const maxAttempts = 3
      let attempts = 0
      let bufferPercentage = 10
      while (attempts < maxAttempts) {
        try {
          const qiOutpoints = await this.chainService.getOutpointsForSending(
            amount,
            bufferPercentage
          )
          const outpointInfos = qiOutpoints.map((outpoint) => ({
            outpoint: outpoint.outpoint,
            address: outpoint.address,
            zone: Zone.Cyprus1,
            derivationPath: outpoint.derivationPath,
          }))
          
          qiWallet.importOutpoints(outpointInfos)
          const tx = await qiWallet.convertToQuai(to, amount, { // This doesn't actually convert to Quai, it just sends a Qi transaction to the provided Quai address
            data: WRAPPED_QI_CONTRACT_ADDRESS_BYTES,
          })
          console.log("wrapping tx", tx)
          transaction = processConvertQiTransaction(
            qiWallet.getPaymentCode(0),
            to, 
            tx as QiTransactionResponse,
            amount,
          )
          break
      } catch (error: any) {
        err = error
        logger.error("Failed to wrap Qi", error.message)
        if (
          error instanceof Error &&
          error.message.includes("Insufficient funds")
        ) {
          bufferPercentage += 10
        } else if (error instanceof Error && error.message.includes("non-existent UTXO")) {
          // Parse the error message to get the outpoint hash and index
          const match = error.message.match(/non-existent UTXO ([0-9a-fA-F]+):(\d+)/)
          if (match) {
            const outpointHash = match[1]
            const outpointIndex = parseInt(match[2], 10)
            
            // Remove the non-existent outpoint from the database
            const chainID = this.chainService.selectedNetwork.chainID
            const nonExistentOutpoint = {
              chainID,
              outpoint: {
                txhash: outpointHash,
                index: outpointIndex,
                denomination: 0, // This doesn't matter for deletion
                lock: 0 // This doesn't matter for deletion
              },
              value: BigInt(0), // This doesn't matter for deletion
              address: "", // This doesn't matter for deletion
              derivationPath: "" // This doesn't matter for deletion
            }
            await this.chainService.removeQiOutpoints([nonExistentOutpoint])
            logger.info(`Removed non-existent outpoint from database: ${outpointHash}:${outpointIndex}`)
          }
        } else {
          await this.chainService.syncQiWallet()
          qiWallet = await this.keyringService.getQiHDWallet()
          qiWallet.connect(jsonRpcProvider)
        }
        attempts++
      }
    }
    if (!transaction) {
      if (err) {
        throw err
      } else {
        throw new Error("Failed to wrap Qi")
      }
    }
    await this.saveQiTransaction(transaction)
    await Promise.all([
      this.subscribeToQiTransaction(transaction.hash),
      this.chainService.syncQiWallet(),
    ])
    return transaction.hash
  }

  public async wrapQuai(value: string, from: string): Promise<string | undefined> {
    const { jsonRpcProvider } = this.chainService
    try {
      const amount = parseQuai(value)
      const signerWithType = await this.keyringService.getSigner(from)

      let connectedSigner: any
      let tx: QuaiTransactionResponse | null = null

      if (isSignerPrivateKeyType(signerWithType)) {
        connectedSigner = signerWithType.signer.connect(jsonRpcProvider)
        const contract = new Contract(
          WRAPPED_QUAI_CONTRACT_ADDRESS,
          ["function deposit() payable"],
          connectedSigner
        )
        tx = (await contract.deposit({ value: amount })) as QuaiTransactionResponse
      } else {
        signerWithType.signer.connect(jsonRpcProvider)
        connectedSigner = signerWithType.signer
        const contract = new Contract(
          WRAPPED_QUAI_CONTRACT_ADDRESS,
          ["function deposit() payable"],
          jsonRpcProvider
        )
        const data = contract.interface.encodeFunctionData("deposit", [])
        const request = {
          to: WRAPPED_QUAI_CONTRACT_ADDRESS,
          from,
          data,
          value: amount,
        }
        tx = (await connectedSigner.sendTransaction(request)) as QuaiTransactionResponse
      }

      if (!tx) {
        throw new Error("Failed to send wrap QUAI transaction")
      }
      await this.processQuaiTransactionResponse(tx)
      return tx.hash
    } catch (error: any) {
      logger.error("Failed to wrap QUAI", error.message)
      throw error
    }
  }

  public async unwrapQuai(value: string, from: string): Promise<string | undefined> {
    const { jsonRpcProvider } = this.chainService
    try {
      const amount = parseQuai(value)
      const signerWithType = await this.keyringService.getSigner(from)

      let connectedSigner: any
      let tx: QuaiTransactionResponse | null = null

      if (isSignerPrivateKeyType(signerWithType)) {
        connectedSigner = signerWithType.signer.connect(jsonRpcProvider)
        const contract = new Contract(
          WRAPPED_QUAI_CONTRACT_ADDRESS,
          ["function withdraw(uint256 amount)"],
          connectedSigner
        )
        tx = (await contract.withdraw(amount)) as QuaiTransactionResponse
      } else {
        signerWithType.signer.connect(jsonRpcProvider)
        connectedSigner = signerWithType.signer
        const contract = new Contract(
          WRAPPED_QUAI_CONTRACT_ADDRESS,
          ["function withdraw(uint256 amount)"],
          jsonRpcProvider
        )
        const data = contract.interface.encodeFunctionData("withdraw", [amount])
        const request = {
          to: WRAPPED_QUAI_CONTRACT_ADDRESS,
          from,
          data,
        }
        tx = (await connectedSigner.sendTransaction(request)) as QuaiTransactionResponse
      }

      if (!tx) {
        throw new Error("Failed to send unwrap WQUAI transaction")
      }
      await this.processQuaiTransactionResponse(tx)
      return tx.hash
    } catch (error: any) {
      logger.error("Failed to unwrap WQUAI", error.message)
      throw error
    }
  }

  public async getWrappedQiDeposit(from: string): Promise<bigint> {
    const { jsonRpcProvider } = this.chainService
    
    try {
      const result = await jsonRpcProvider.send("quai_getWrappedQiDeposit", [
        WRAPPED_QI_CONTRACT_ADDRESS,
        from,
        "latest"
      ], Shard.Cyprus1)
      console.log(result)
      return result
    } catch (error: any) {
      if (error.message.includes("no wrapped Qi balance")) {
        return BigInt(0)
      }
      logger.error("Failed to get wrapped Qi deposit", error.message)
      throw error
    }
  }

  public async startIntervalConversion(params: {
    from: any,
    to: any,
    amount: string,
    maxSlippage: number,
    transactionCount: number,
    intervalMinutes: number
  }): Promise<string> {
    const intervalId = `interval_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    let executedCount = 0
    const transactions: string[] = []
    
    // Store interval in database
    await this.db.addIntervalConversion({
      id: intervalId,
      from: params.from,
      to: params.to,
      amount: params.amount,
      maxSlippage: params.maxSlippage,
      transactionCount: params.transactionCount,
      intervalMinutes: params.intervalMinutes,
      executedCount: 0,
      status: "running",
      startedAt: Date.now(),
      transactions: []
    })

    // Guard flag to prevent concurrent execution if interval fires before previous completes
    let isExecuting = false

    const executeConversion = async () => {
      // Skip if a previous execution is still in progress
      if (isExecuting) {
        logger.info(`Interval conversion ${intervalId}: skipping execution - previous conversion still in progress`)
        return
      }

      isExecuting = true
      try {
        // Check if interval was cancelled
        const intervalData = await this.db.getIntervalConversion(intervalId)
        if (intervalData?.status === "cancelled") {
          this.stopIntervalConversion(intervalId)
          logger.info(`Interval conversion ${intervalId} was cancelled`)
          return
        }

        // Check if we should stop
        if (executedCount >= params.transactionCount) {
          await this.db.updateIntervalConversion(intervalId, {
            status: "completed",
            completedAt: Date.now(),
            executedCount
          })
          this.stopIntervalConversion(intervalId)
          logger.info(`Interval conversion ${intervalId} completed after ${executedCount} transactions`)
          return
        }

        // Check if conversion is from UTXO to Account or vice versa
        const isFromUtxo = isUtxoAccountTypeGuard(params.from)
        const isToUtxo = isUtxoAccountTypeGuard(params.to)

        let txHash: string | undefined
        // Execute the conversion based on type
        if (isFromUtxo && !isToUtxo) {
          // Converting Qi to Quai
          await this.convertQiToQuai(params.to.address, params.amount, params.maxSlippage)
          // TODO: Get transaction hash from conversion
          txHash = `tx_${Date.now()}`
        } else if (!isFromUtxo && isToUtxo) {
          // Converting Quai to Qi
          await this.convertQuaiToQi(params.from.address, params.amount, params.maxSlippage)
          // TODO: Get transaction hash from conversion
          txHash = `tx_${Date.now()}`
        } else {
          throw new Error("Invalid conversion type")
        }

        executedCount++
        if (txHash) transactions.push(txHash)
        
        await this.db.updateIntervalConversion(intervalId, {
          executedCount,
          transactions
        })
        
        logger.info(`Interval conversion ${intervalId}: executed ${executedCount}/${params.transactionCount} transactions`)
        
      } catch (error: any) {
        // Capture detailed error information
        let errorMessage = "Unknown error"
        let errorDetails = ""
        
        if (error instanceof Error) {
          errorMessage = error.message || "Unknown error"
          // Capture stack trace for more context
          errorDetails = error.stack ? ` Stack: ${error.stack.split('\n').slice(0, 3).join(' ')}` : ""
        } else if (typeof error === 'string') {
          errorMessage = error
        } else if (error && typeof error === 'object') {
          errorMessage = error.message || JSON.stringify(error)
          errorDetails = error.stack || ""
        }
        
        // Combine message and details for storage
        const fullErrorMessage = errorMessage + errorDetails
        
        logger.error(`Interval conversion ${intervalId} failed with error:`, {
          message: errorMessage,
          details: errorDetails,
          fullError: error
        })
        
        // Update database with detailed error
        await this.db.updateIntervalConversion(intervalId, {
          status: "failed",
          completedAt: Date.now(),
          error: fullErrorMessage.substring(0, 1000), // Limit to 1000 chars for DB storage
          executedCount
        })
        
        // Check for insufficient balance error
        if (errorMessage.includes("Insufficient") || errorMessage.includes("balance")) {
          logger.error(`Interval conversion ${intervalId} stopped due to insufficient balance`)
          this.stopIntervalConversion(intervalId)
          NotificationsManager.createFailedQiTxNotification()
        } else {
          logger.error(`Interval conversion ${intervalId} error: ${errorMessage}`)
          this.stopIntervalConversion(intervalId)
        }
      } finally {
        // Always reset the execution flag so next interval can run
        isExecuting = false
      }
    }

    // Execute first conversion immediately
    executeConversion()

    // Set up interval for remaining conversions
    const intervalMs = params.intervalMinutes * 60 * 1000
    const interval = setInterval(executeConversion, intervalMs)
    this.intervalConversions.set(intervalId, interval)

    logger.info(`Started interval conversion ${intervalId}: ${params.transactionCount} transactions every ${params.intervalMinutes} minutes`)
    return intervalId
  }

  public async cancelIntervalConversion(intervalId: string): Promise<void> {
    const interval = this.intervalConversions.get(intervalId)
    if (interval) {
      clearInterval(interval)
      this.intervalConversions.delete(intervalId)
      
      await this.db.updateIntervalConversion(intervalId, {
        status: "cancelled",
        completedAt: Date.now()
      })
      
      logger.info(`Cancelled interval conversion ${intervalId}`)
    }
  }

  public async getIntervalConversions(): Promise<any[]> {
    return this.db.getAllIntervalConversions()
  }

  public async getIntervalConversion(intervalId: string): Promise<any> {
    return this.db.getIntervalConversion(intervalId)
  }

  private async restartRunningIntervals(): Promise<void> {
    try {
      const runningIntervals = await this.db.getRunningIntervalConversions()
      logger.info(`Found ${runningIntervals.length} running intervals to restart`)
      
      for (const interval of runningIntervals) {
        // Mark as failed if it was running when the service stopped
        await this.db.updateIntervalConversion(interval.id, {
          status: "failed",
          completedAt: Date.now(),
          error: "Interval was interrupted by extension restart"
        })
        logger.info(`Marked interval ${interval.id} as failed due to restart`)
      }
    } catch (error) {
      logger.error("Failed to restart running intervals:", error)
    }
  }

  private stopIntervalConversion(intervalId: string): void {
    const interval = this.intervalConversions.get(intervalId)
    if (interval) {
      clearInterval(interval)
      this.intervalConversions.delete(intervalId)
      logger.info(`Stopped interval conversion ${intervalId}`)
    }
  }

  public async convertQiToQuai(to: string, value: string, maxSlippage: number): Promise<void> {
    const amount = parseQi(value)
    const { jsonRpcProvider } = this.chainService
    let qiWallet = await this.keyringService.getQiHDWallet()
    qiWallet.connect(jsonRpcProvider)
    let transaction: QiTransactionDB | null = null
    let lastError: any = null
    let txRefundAddress: string | undefined
    try {
      const maxAttempts = 3
      let attempts = 0
      let bufferPercentage = 10
      while (attempts < maxAttempts) {
        try {
          const qiOutpoints = await this.chainService.getOutpointsForSending(
            amount,
            bufferPercentage
          )

          const outpointInfos = qiOutpoints.map((outpoint) => ({
            outpoint: outpoint.outpoint,
            address: outpoint.address,
            zone: Zone.Cyprus1,
            derivationPath: outpoint.derivationPath,
          }))
          
          qiWallet.importOutpoints(outpointInfos)

          let slippageData = encodeTwoBytesBigEndian(maxSlippage)

          const refundAddress = qiWallet.getNextAddressSync(0, Zone.Cyprus1).address
          txRefundAddress = refundAddress
          const refundAddressBytes = Buffer.from(refundAddress.replace('0x', ''), 'hex');

          const combinedData = new Uint8Array(slippageData.length + refundAddressBytes.length);
          combinedData.set(slippageData);
          // Copy refund address data after slippage data
          combinedData.set(refundAddressBytes, slippageData.length);

          const tx = await qiWallet.convertToQuai(to, amount, {
            data: combinedData,
          })

          // Immediately remove the used outpoints from the database to prevent reuse
          // before the next sync completes (critical for interval conversions)
          await this.chainService.removeQiOutpoints(qiOutpoints)
          logger.info(`Removed ${qiOutpoints.length} spent outpoints from database after successful conversion`)

          // Persist wallet state so address status changes are saved to disk
          await this.keyringService.vaultManager.add(
            { qiHDWallet: qiWallet.serialize() }, {}
          )

          const senderPaymentCode = qiWallet.getPaymentCode(0)

          transaction = processConvertQiTransaction(
            senderPaymentCode,
            to,
            tx as QiTransactionResponse,
            amount,
            refundAddress,
          )
          break
        } catch (error: any) {
          const errorMsg = error?.message || String(error)
          logger.error("Failed to convert Qi to Quai", errorMsg, error)
          
          // Store the last error for better reporting
          lastError = error
          
          if (
            error instanceof Error &&
            error.message.includes("Insufficient funds")
          ) {
            bufferPercentage += 10
          } else if (error instanceof Error && error.message.includes("non-existent UTXO")) {
            // Parse the error message to get the outpoint hash and index
            const match = error.message.match(/non-existent UTXO ([0-9a-fA-F]+):(\d+)/)
            if (match) {
              const outpointHash = match[1]
              const outpointIndex = parseInt(match[2], 10)
              
              // Remove the non-existent outpoint from the database
              const chainID = this.chainService.selectedNetwork.chainID
              const nonExistentOutpoint = {
                chainID,
                outpoint: {
                  txhash: outpointHash,
                  index: outpointIndex,
                  denomination: 0, // This doesn't matter for deletion
                  lock: 0 // This doesn't matter for deletion
                },
                value: BigInt(0), // This doesn't matter for deletion
                address: "", // This doesn't matter for deletion
                derivationPath: "" // This doesn't matter for deletion
              }
              await this.chainService.removeQiOutpoints([nonExistentOutpoint])
              logger.info(`Removed non-existent outpoint from database: ${outpointHash}:${outpointIndex}`)
            }
            // Continue to next attempt with fresh outpoints after removal
            qiWallet = await this.keyringService.getQiHDWallet()
            qiWallet.connect(jsonRpcProvider)
          } else {
            await this.chainService.syncQiWallet()
            qiWallet = await this.keyringService.getQiHDWallet()
            qiWallet.connect(jsonRpcProvider)
          }
          attempts++
        }
      }
      if (!transaction) {
        const lastErrorMsg = lastError ? (lastError.message || String(lastError)) : "No specific error captured"
        const detailedError = `Failed to convert Qi to Quai after ${attempts} attempts. Last error: ${lastErrorMsg}. Buffer percentage: ${bufferPercentage}%`
        logger.error(detailedError, { lastError, attempts, bufferPercentage })
        throw new Error(detailedError)
      }
      await this.saveQiTransaction(transaction)
      await Promise.all([
        txRefundAddress
          ? this.monitorConversion(transaction.hash, txRefundAddress, to)
          : this.subscribeToQiTransaction(transaction.hash),
        this.chainService.syncQiWallet(),
      ])
    } catch (error: any) {
      logger.error("Failed to convert Qi to Quai", error.message)
      NotificationsManager.createFailedQiTxNotification()
      // Re-throw the error so interval conversions can track it
      throw error
    }
  }

  /**
   * @returns {Promise<boolean>} - True if a channel is known and notification is unnecessary; false if receiver needs notification.
   */
  public async doesChannelExistForReceiver(
    senderPaymentCode: string,
    receiverPaymentCode: string
  ): Promise<boolean> {
    const { jsonRpcProvider } = this.chainService
    const mailboxContract = new Contract(
      this.MAILBOX_CONTRACT_ADDRESS,
      MAILBOX_INTERFACE,
      jsonRpcProvider
    )

    try {
      // check if channel is established: receiver notified and local record exists
      const [receiverPaymentChannels, paymentChannel] = await Promise.all([
        mailboxContract.getNotifications(receiverPaymentCode),
        this.db.getPaymentChannel(receiverPaymentCode),
      ])

      if (receiverPaymentChannels.includes(senderPaymentCode)) {
        if (paymentChannel) {
          // channel is established and can be reopened using getNotifications on both sides
          return true
        }

        // channel is established but only receiver knows about it, so we need update our local db
        await this.db.addPaymentChannel(receiverPaymentCode)
        return true
      }
    } catch (error: any) {
      logger.error(
        `Error checking if payment channel is established: ${
          error?.message || error
        }`
      )
      throw error
    }

    return false
  }

  public async checkReceivedQiTransactions(): Promise<void> {
    const { jsonRpcProvider } = this.chainService

    const [qiWallet, dbTransactions] = await Promise.all([
      this.keyringService.getQiHDWallet(),
      this.db.getAllQiTransactions(),
    ])
    qiWallet.connect(jsonRpcProvider)
    await qiWallet.sync(Zone.Cyprus1, 0)

    const blockTimestampCache = new Map<string, number>()
    const outpoints = qiWallet.getOutpoints(Zone.Cyprus1)
    const changeAddresses = qiWallet.getChangeAddressesForZone(Zone.Cyprus1)
    const uniqueHashes = getUniqueQiTransactionHashes(outpoints, dbTransactions)

    await Promise.all(
      Array.from(uniqueHashes).map(async (hash) => {
        const response = await jsonRpcProvider.getTransaction(hash)
        if (response && response.blockNumber && response.blockHash) {
          let timestamp: number

          if (blockTimestampCache.has(response.blockHash)) {
            timestamp = blockTimestampCache.get(response.blockHash)!
          } else {
            const block = await jsonRpcProvider.getBlock(
              Shard.Cyprus1,
              response.blockHash
            )
            timestamp = block ? Number(block.woHeader.timestamp) : Date.now()
            blockTimestampCache.set(response.blockHash, timestamp)
          }

          const transaction = processReceivedQiTransaction(
            response as QiTransactionResponse,
            timestamp,
            changeAddresses,
            qiWallet.getPaymentCode(0)
          )
          await this.saveQiTransaction(transaction)
        } else {
          await this.subscribeToQiTransaction(hash)
        }
      })
    )
  }


  public async claimWrappedQiDeposit(from: string): Promise<void> {
    try {
      const { jsonRpcProvider } = this.chainService
      const signerWithType = await this.keyringService.getSigner(from)
      let connectedSigner: any
      

      let tx: QuaiTransactionResponse | null = null
      if (isSignerPrivateKeyType(signerWithType)) {
        connectedSigner = signerWithType.signer.connect(jsonRpcProvider)
        const contract = new Contract(
          WRAPPED_QI_CONTRACT_ADDRESS,
          ["function claimDeposit() external returns (uint256)"],
          signerWithType.signer
        )
        tx = await contract.claimDeposit()
      } else {
        signerWithType.signer.connect(jsonRpcProvider)
        connectedSigner = signerWithType.signer
        // For HD Wallet signers, we need to construct the transaction request
        const contract = new Contract(
          WRAPPED_QI_CONTRACT_ADDRESS,
          ["function claimDeposit() external returns (uint256)"],
          jsonRpcProvider
        )
        
        // Get the encoded function data
        const data = contract.interface.encodeFunctionData("claimDeposit")
        
        // Construct the transaction request
        const request = {
          to: WRAPPED_QI_CONTRACT_ADDRESS,
          from,
          data,
        }
        
        tx = (await connectedSigner.sendTransaction(
          request
        )) as QuaiTransactionResponse
      }

      if (!tx) {
        throw new Error("Failed to send claim transaction")
      }
      console.log("claim tx", tx)
      await this.processQuaiTransactionResponse(tx)
    } catch (error: any) {
      logger.error("Failed to claim wrapped Qi deposit for account", error.message)
      throw error
    }
  }

  // ------------------------------------ private methods ------------------------------------
  /**
   * Fetches all transactions from the database and emits them to update the UI,
   * on TransactionService initialization.
   */
  private async initializeQuaiTransactions(): Promise<void> {
    const transactions = await this.db.getAllQuaiTransactions()
    const accounts = await this.chainService.getAccountsToTrack()
    this.emitter.emit("initializeQuaiTransactions", {
      transactions,
      accounts,
    })
  }

  private async initializeQiTransactions(): Promise<void> {
    const transactions = await this.db.getAllQiTransactions()
    this.emitter.emit("initializeQiTransactions", transactions)
  }

  /**
   * Gets all pending transactions from the database and attempts to confirm them.
   * If the transaction is already confirmed and has a receipt, it updates the transaction with the receipt.
   * Otherwise, subscribes to transaction confirmation.
   */
  private async checkPendingQuaiTransactions(): Promise<void> {
    const { jsonRpcProvider } = this.chainService

    const pendingTransactions = await this.db.getPendingQuaiTransactions()
    if (pendingTransactions.length <= 0) return

    await Promise.all(
      pendingTransactions.map(async ({ hash }) => {
        const receipt = await jsonRpcProvider.getTransactionReceipt(hash)
        if (receipt) {
          await this.handleQuaiTransactionReceipt(receipt)
        } else {
          await this.subscribeToQuaiTransaction(hash)
        }
      })
    )
  }

  private async checkPendingQiTransactions(): Promise<void> {
    const { jsonRpcProvider } = this.chainService

    const pendingTransactions = await this.db.getPendingQiTransactions()
    if (pendingTransactions.length <= 0) return

    await Promise.all(
      pendingTransactions.map(async ({ hash }) => {
        const transaction = await jsonRpcProvider.getTransaction(hash)
        if (transaction && transaction.blockNumber) {
          await this.handleQiTransaction(transaction as TransactionResponse)
        } else {
          await this.subscribeToQiTransaction(hash)
        }
      })
    )
  }

  /**
   * Recovers pending Qi-to-Quai conversions after extension restart.
   * Checks on-chain state to determine if conversions succeeded or reverted.
   */
  private async recoverPendingConversions(): Promise<void> {
    try {
      const pendingTransactions = await this.db.getPendingQiTransactions()
      const pendingConversions = pendingTransactions.filter(
        (tx) =>
          tx.type === UtxoActivityType.CONVERT &&
          tx.status === TransactionStatus.PENDING &&
          tx.refundAddress
      )

      if (pendingConversions.length === 0) return
      logger.info(`Recovering ${pendingConversions.length} pending conversions`)

      const { jsonRpcProvider } = this.chainService

      for (const conversion of pendingConversions) {
        try {
          const tx = await jsonRpcProvider.getTransaction(conversion.hash)
          if (tx && tx.blockNumber) {
            // Transaction was mined while offline — check if reverted
            const outpoints = await this.chainService.getOutpointsForQiAddress(
              conversion.refundAddress!
            )
            if (outpoints && outpoints.length > 0) {
              await this.handleConversionReverted(
                conversion.hash,
                conversion.refundAddress!
              )
            } else {
              await this.handleConversionSucceeded(conversion.hash)
            }
          } else if (conversion.quaiRecipient) {
            // Still pending — re-subscribe
            this.monitorConversion(
              conversion.hash,
              conversion.refundAddress!,
              conversion.quaiRecipient
            )
          }
        } catch (error) {
          logger.error(
            `Failed to recover conversion ${conversion.hash}:`,
            error
          )
        }
      }
    } catch (error) {
      logger.error("Failed to recover pending conversions:", error)
    }
  }

  /**
   * Processes a new Quai transaction response by converting it into a transaction object
   * with a `PENDING` status, saving it to the database, and emitting an event with the transaction hash.
   * Subscribes to the transaction for future updates or confirmations.
   *
   * @param {QuaiTransactionResponse} transactionResponse - The response received after sending the transaction.
   */
  private async processQuaiTransactionResponse(
    transactionResponse: QuaiTransactionResponse
  ): Promise<void> {
    const transaction = quaiTransactionFromResponse(
      transactionResponse,
      TransactionStatus.PENDING
    )
    await this.saveQuaiTransaction(transaction)
    this.emitter.emit("transactionSend", transactionResponse.hash)
    this.subscribeToQuaiTransaction(transactionResponse.hash)
  }

  /**
   * Subscribes to a transaction confirmation event and updates the transaction status once confirmed.
   *
   * @param {string} hash - The hash of the transaction to subscribe to.
   */
  private async subscribeToQuaiTransaction(hash: string): Promise<void> {
    const { jsonRpcProvider } = this.chainService

    try {
      const receipt = await jsonRpcProvider.waitForTransaction(
        hash,
        TRANSACTION_CONFIRMATIONS,
        TRANSACTION_RECEIPT_WAIT_TIMEOUT
      )
      if (receipt) {
        await this.handleQuaiTransactionReceipt(receipt)
      } else {
        // dropped / failed
        await this.handleQuaiTransactionFail(hash)
      }
    } catch (error: any) {
      // dropped / failed
      logger.error(
        `Error subscribing to Quai transaction: ${error?.message || error}`
      )
      await this.handleQuaiTransactionFail(hash)
    }
  }

  private async subscribeToQiTransaction(hash: string): Promise<void> {
    let transaction = null
    const { jsonRpcProvider } = this.chainService
    const startTime = Date.now()
    const QI_TX_TIMEOUT = 5 * MINUTE

    while (!(transaction && transaction.blockNumber && transaction.blockHash)) {
      if (Date.now() - startTime > QI_TX_TIMEOUT) {
        logger.warn(`Qi transaction ${hash} timed out after 5 minutes`)
        await this.handleQiTransactionTimeout(hash)
        return
      }

      await new Promise((resolve) =>
        setTimeout(resolve, QI_TRANSACTIONS_FETCH_INTERVAL)
      )

      try {
        transaction = await jsonRpcProvider.getTransaction(hash)
      } catch (error: any) {
        logger.error(
          `Error fetching qi transaction confirmation: ${
            error?.message || error
          }`
        )
        break
      }

      if (transaction && transaction.blockNumber && transaction.blockHash) {
        await this.handleQiTransaction(transaction as TransactionResponse)
      }
    }
  }

  private async handleQiTransactionTimeout(hash: string): Promise<void> {
    const transaction = await this.db.getQiTransactionByHash(hash)
    if (transaction) {
      transaction.status = TransactionStatus.FAILED
      await this.updateQiTransaction(transaction)
    }

    // Scan will naturally mark unfunded addresses as UNUSED
    this.chainService.syncQiWallet()
    NotificationsManager.createFailedQiTxNotification()
  }

  /**
   * Monitors a Qi-to-Quai conversion by subscribing to both the Qi refund address
   * and the Quai recipient address. Determines if the conversion succeeded or reverted.
   */
  private async monitorConversion(
    txHash: string,
    refundAddress: string,
    quaiRecipient: string
  ): Promise<void> {
    const { webSocketProvider } = this.chainService
    let resolved = false

    const cleanup = () => {
      webSocketProvider.off({ type: "balance", address: refundAddress })
      webSocketProvider.off({ type: "balance", address: quaiRecipient })
      this.conversionMonitors.delete(txHash)
    }

    // Subscribe to Qi refund address — if it receives balance, conversion reverted
    webSocketProvider.on(
      { type: "balance", address: refundAddress },
      async () => {
        if (resolved) return
        resolved = true
        cleanup()
        await this.handleConversionReverted(txHash, refundAddress)
      }
    )

    // Subscribe to Quai recipient — if it receives balance, conversion likely succeeded
    webSocketProvider.on(
      { type: "balance", address: quaiRecipient },
      async () => {
        // Brief delay to check if refund also arrives (edge case)
        await new Promise((resolve) => setTimeout(resolve, 2000))
        if (resolved) return
        resolved = true
        cleanup()
        await this.handleConversionSucceeded(txHash)
      }
    )

    // Store cleanup function for service shutdown
    this.conversionMonitors.set(txHash, cleanup)

    // Timeout fallback: if neither subscription fires within 5 minutes,
    // check on-chain state directly
    const CONVERSION_MONITOR_TIMEOUT = 5 * MINUTE
    setTimeout(async () => {
      if (resolved) return
      resolved = true
      cleanup()
      logger.info(`Conversion monitor timeout for ${txHash}, checking on-chain state`)

      try {
        const outpoints = await this.chainService.getOutpointsForQiAddress(refundAddress)
        if (outpoints && outpoints.length > 0) {
          await this.handleConversionReverted(txHash, refundAddress)
        } else {
          // Check if Qi tx was mined at all
          const tx = await this.chainService.jsonRpcProvider.getTransaction(txHash)
          if (tx && tx.blockNumber) {
            await this.handleConversionSucceeded(txHash)
          } else {
            // Tx never mined — fall back to standard polling
            await this.subscribeToQiTransaction(txHash)
          }
        }
      } catch (error) {
        logger.error(`Error in conversion monitor fallback for ${txHash}:`, error)
        await this.subscribeToQiTransaction(txHash)
      }
    }, CONVERSION_MONITOR_TIMEOUT)
  }

  /**
   * Handles a successful Qi-to-Quai conversion by marking the local transaction
   * record as confirmed.
   */
  private async handleConversionSucceeded(txHash: string): Promise<void> {
    const transaction = await this.db.getQiTransactionByHash(txHash)
    if (!transaction) return

    transaction.status = TransactionStatus.CONFIRMED
    await this.updateQiTransaction(transaction)
    logger.info(`Conversion ${txHash} succeeded`)
  }

  /**
   * Handles a reverted Qi-to-Quai conversion. Updates transaction status and
   * triggers a wallet sync to pick up the refunded outpoints.
   */
  private async handleConversionReverted(
    txHash: string,
    refundAddress: string
  ): Promise<void> {
    const transaction = await this.db.getQiTransactionByHash(txHash)
    if (!transaction) return

    transaction.status = TransactionStatus.REVERTED
    await this.updateQiTransaction(transaction)
    logger.info(`Conversion ${txHash} reverted — funds returned to ${refundAddress}`)

    NotificationsManager.createRevertedConversionNotification()

    // Sync wallet to pick up the refunded outpoints
    this.chainService.syncQiWallet()
  }

  /**
   * Saves or updates a transaction in the database and notifies the UI about the updated transaction.
   * Emits an event to notify the UI about a transaction update.
   *
   * @param {QuaiTransactionDB} transaction - The transaction to save or update.
   */
  private async saveQuaiTransaction(
    transaction: QuaiTransactionDB
  ): Promise<void> {
    await this.db.addOrUpdateQuaiTransaction(transaction)
    const accounts = await this.chainService.getAccountsToTrack()
    const forAccounts = getRelevantTransactionAddresses(transaction, accounts)
    this.emitter.emit("updateQuaiTransaction", {
      transaction,
      forAccounts,
    })
  }

  /**
   * Saves or updates a transaction in the database and notifies the UI about the updated transaction.
   * Emits an event to notify the UI about a transaction update.
   *
   * @param {QiTransactionDB} transaction - The transaction to save or update.
   */
  private async saveQiTransaction(transaction: QiTransactionDB): Promise<void> {
    await this.db.addOrUpdateQiTransaction(transaction)
    this.emitter.emit("addUtxoActivity", transaction)
  }

  private async updateQiTransaction(
    transaction: QiTransactionDB
  ): Promise<void> {
    await this.db.addOrUpdateQiTransaction(transaction)
    this.emitter.emit("updateUtxoActivity", transaction)
  }

  private async handleQiTransaction(
    transactionResponse: TransactionResponse
  ): Promise<void> {
    const { hash, blockHash, blockNumber } = transactionResponse

    const transaction = await this.db.getQiTransactionByHash(hash)
    if (!transaction) return

    transaction.status = TransactionStatus.CONFIRMED
    transaction.blockHash = blockHash
    transaction.blockNumber = blockNumber

    await this.updateQiTransaction(transaction)
  }

  /**
   * Updates a transaction in the database with the receipt data.
   * Checks the status of a receipt to determine whether the transaction has been confirmed or reverted.
   *
   * @param {TransactionReceipt} receipt - The transaction receipt data.
   */
  private async handleQuaiTransactionReceipt(
    receipt: TransactionReceipt
  ): Promise<void> {
    const transaction = await this.db.getQuaiTransactionByHash(receipt.hash)
    if (!transaction) return

    const { status, blockHash, blockNumber, gasPrice, gasUsed } = receipt

    if (status === 1) {
      transaction.status = TransactionStatus.CONFIRMED
      NotificationsManager.createSuccessTxNotification(
        transaction.nonce,
        transaction.hash
      )
    } else if (status === 0) {
      // reverted
      transaction.status = TransactionStatus.FAILED
    }

    transaction.blockHash = blockHash
    transaction.blockNumber = blockNumber
    transaction.gasPrice = gasPrice
    transaction.gasUsed = gasUsed

    // TODO these fields are not very important now,
    //  but in the future it is better to get these fields from the receipt.
    //  quais returns an object with read-only fields, which complicates our work
    transaction.outboundEtxs = []
    transaction.logs = []

    await this.saveQuaiTransaction(transaction)
  }

  /**
   * Updates a transaction in the database with the failed status.
   *
   * @param {string} hash - The hash of the transaction to update.
   */
  private async handleQuaiTransactionFail(hash: string): Promise<void> {
    const transaction = await this.db.getQuaiTransactionByHash(hash)
    if (transaction) {
      transaction.status = TransactionStatus.FAILED
      await this.saveQuaiTransaction(transaction)
    }
  }

  private async notifyQiRecipient(
    quaiAddress: string,
    senderPaymentCode: string,
    receiverPaymentCode: string
  ): Promise<void> {
    try {
      const { jsonRpcProvider } = this.chainService

      let privateKey: string
      const signerWithType = await this.keyringService.getSigner(quaiAddress)
      if (isSignerPrivateKeyType(signerWithType)) {
        privateKey = signerWithType.signer.privateKey
      } else {
        privateKey = signerWithType.signer.getPrivateKey(quaiAddress)
      }
      const wallet = new Wallet(privateKey, jsonRpcProvider)

      const mailboxContract = new Contract(
        this.MAILBOX_CONTRACT_ADDRESS,
        MAILBOX_INTERFACE,
        wallet
      )
      const tx = await mailboxContract.notify(
        senderPaymentCode,
        receiverPaymentCode
      )
      await tx.wait()

      // add payment channel if the recipient has been notified
      await this.db.addPaymentChannel(receiverPaymentCode)
    } catch (error: any) {
      logger.error(
        `Error occurs while notifying Qi recipient: ${error?.message || error}`
      )
    }
  }
}

function encodeTwoBytesBigEndian(value: number): Uint8Array {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint16(0, value, false); // false for big-endian
  return new Uint8Array(buffer);
}
