import {
  QiTransactionResponse,
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import {
  Contract,
  getZoneForAddress,
  parseQi,
  parseQuai,
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
import logger from "../../lib/logger"
import KeyringService from "../keyring"
import { HexString } from "../../types"
import { MAILBOX_CONTRACT_ADDRESS, MINUTE, SECOND } from "../../constants"
import { QiTransactionDB, QuaiTransactionDB, TransactionStatus } from "./types"
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

const TRANSACTION_CONFIRMATIONS = 1
const QI_TRANSACTIONS_FETCH_INTERVAL = 10 * SECOND
const TRANSACTION_RECEIPT_WAIT_TIMEOUT = 10 * MINUTE

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

    await this.initializeQiTransactions()
    await this.initializeQuaiTransactions()
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
    } catch (error) {
      logger.error("Failed to sign and send Quai transaction", error)
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
    } catch (error) {
      logger.error("Failed to send Quai transaction", error)
      this.emitter.emit("transactionSendFailure")
    }
  }

  public async sendQiTransaction(
    amount: bigint,
    quaiAddress: string,
    senderPaymentCode: string,
    receiverPaymentCode: string,
    minerTip: bigint | null
  ): Promise<void> {
    try {
      const { jsonRpcProvider } = this.chainService

      const qiWallet = await this.keyringService.getQiHDWallet()
      qiWallet.connect(jsonRpcProvider)
      await qiWallet.sync(Zone.Cyprus1, 0)

      let tx: QiTransactionResponse
      try {
        tx = (await qiWallet.sendTransaction(
          receiverPaymentCode,
          amount,
          Zone.Cyprus1,
          Zone.Cyprus1
        )) as QiTransactionResponse
      } catch (error) {
        await qiWallet.scan(Zone.Cyprus1, 0)
        tx = (await qiWallet.sendTransaction(
          receiverPaymentCode,
          amount,
          Zone.Cyprus1,
          Zone.Cyprus1
        )) as QiTransactionResponse
      }

      const transaction = processSentQiTransaction(
        senderPaymentCode,
        receiverPaymentCode,
        tx as QiTransactionResponse,
        amount
      )
      await this.saveQiTransaction(transaction)

      // Wait for the transaction to be included in a block
      await this.subscribeToQiTransaction(transaction.hash)
      await qiWallet.sync(Zone.Cyprus1, 0)
      await this.keyringService.vaultManager.add(
        {
          qiHDWallet: qiWallet.serialize(),
        },
        {}
      )

      const channelExists = await this.doesChannelExistForReceiver(
        senderPaymentCode,
        receiverPaymentCode
      )
      if (!channelExists) {
        await this.notifyQiRecipient(
          quaiAddress,
          senderPaymentCode,
          receiverPaymentCode,
          minerTip
        )
      }

      NotificationsManager.createSendQiTxNotification()
    } catch (error) {
      logger.error("Failed to send Qi transaction", error)

      const { chainID } = this.chainService.selectedNetwork
      const transaction = processFailedQiTransaction(
        senderPaymentCode,
        receiverPaymentCode,
        amount,
        chainID
      )
      await this.saveQiTransaction(transaction)
      NotificationsManager.createFailedQiTxNotification()
    }
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

  public async convertQuaiToQi(from: string, value: string): Promise<void> {
    const amount = parseQuai(value)
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
      const maxAttempts = 200
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
        logger.warn(
          "Maximum attempts reached without finding an unused address."
        )
        return
      }
    }

    const convertTxRequest = {
      to: unusedAddress,
      from,
      value: amount,
    }
    await this.signAndSendQuaiTransaction(convertTxRequest)
  }

  public async convertQiToQuai(to: string, value: string): Promise<void> {
    const { jsonRpcProvider } = this.chainService
    const qiWallet = await this.keyringService.getQiHDWallet()
    qiWallet.connect(jsonRpcProvider)

    const amount = parseQi(value)
    try {
      const tx = await qiWallet.convertToQuai(to, amount)

      const senderPaymentCode = qiWallet.getPaymentCode(0)

      const transaction = processConvertQiTransaction(
        senderPaymentCode,
        to,
        tx as QiTransactionResponse,
        amount
      )
      await this.saveQiTransaction(transaction)
      await this.subscribeToQiTransaction(transaction.hash)

      await qiWallet.sync(Zone.Cyprus1, 0)
      await this.keyringService.vaultManager.add(
        {
          qiHDWallet: qiWallet.serialize(),
        },
        {}
      )
    } catch (error) {
      logger.error("Failed to convert Qi to Quai", error)
      NotificationsManager.createFailedQiTxNotification()
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
    } catch (error) {
      logger.error("Error checking if payment channel is established:", error)
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
    } catch (error) {
      // dropped / failed
      logger.error(error)
      await this.handleQuaiTransactionFail(hash)
    }
  }

  private async subscribeToQiTransaction(hash: string): Promise<void> {
    let transaction = null
    const { jsonRpcProvider } = this.chainService

    while (transaction === null) {
      await new Promise((resolve) =>
        setTimeout(resolve, QI_TRANSACTIONS_FETCH_INTERVAL)
      )

      try {
        transaction = await jsonRpcProvider.getTransaction(hash)
      } catch (error) {
        logger.error("Error fetching qi transaction confirmation", error)
        break
      }

      if (transaction && transaction.blockNumber) {
        await this.handleQiTransaction(transaction as TransactionResponse)
      }
    }
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
    receiverPaymentCode: string,
    minerTip: bigint | null
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
      const gasOptions = minerTip ? { minerTip } : {}
      const tx = await mailboxContract.notify(
        senderPaymentCode,
        receiverPaymentCode,
        gasOptions
      )
      await tx.wait()

      // add payment channel if the recipient has been notified
      await this.db.addPaymentChannel(receiverPaymentCode)
    } catch (error) {
      logger.error("Error occurs while notifying Qi recipient", error)
    }
  }
}
