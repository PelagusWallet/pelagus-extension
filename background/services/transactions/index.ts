import {
  QiTransactionResponse,
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
// AddressStatus enum values from quais - inlined to avoid module resolution issues
const QI_ADDRESS_STATUS = { UNUSED: 'UNUSED', USED: 'USED', ATTEMPTED_USE: 'ATTEMPTED_USE', UNKNOWN: 'UNKNOWN' } as const
import {
  Contract,
  denominations,
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
import type { NetworkInterface } from "../../constants/networks/networkTypes"
import { MAILBOX_CONTRACT_ADDRESS, MINUTE, SECOND, WRAPPED_QI_CONTRACT_ADDRESS, WRAPPED_QI_CONTRACT_ADDRESS_BYTES, WRAPPED_QUAI_CONTRACT_ADDRESS } from "../../constants"
import {
  QiTransactionDB,
  QuaiTransactionDB,
  QuaiTransactionRequestWithAnnotation,
  TransactionStatus,
  UtxoActivityType,
} from "./types"
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

const QI_TRANSACTIONS_FETCH_INTERVAL = 10 * SECOND
const QUAI_TRANSACTION_FALLBACK_INTERVAL = 30 * SECOND
const TRANSACTION_RECEIPT_WAIT_TIMEOUT = 10 * MINUTE
const PROCESSED_ACCESS_BLOCK_TTL = MINUTE

/**
 * The `TransactionService` class is responsible for handling user transactions, including sending,
 * tracking, and updating transaction statuses. This service uses a database to save and
 * update transaction records and emits events to update the UI with the latest transaction statuses.
 *
 * Key functionalities include:
 * 1. Sending user transactions and emitting events upon transaction submission and updates.
 * 2. Maintaining its own database to store and manage transactions.
 * 3. Emitting all users' transactions on startup, and updating the UI upon transaction status changes.
 * 4. Monitoring sent transactions through address-access events and updating transaction data with confirmed receipts.
 * 5. Fetching pending transactions from the database on startup and checking their status (confirmed or still pending).
 *    This ensures transactions are monitored again if the extension process is killed before confirmation.
 */
export default class TransactionService extends BaseService<TransactionServiceEvents> {
  public readonly MAILBOX_CONTRACT_ADDRESS = MAILBOX_CONTRACT_ADDRESS || ""
  private intervalConversions: Map<string, NodeJS.Timeout> = new Map()
  private conversionMonitors: Map<string, () => void> = new Map()
  private quaiConfirmationRequests: Map<string, Promise<boolean>> = new Map()
  private quaiMonitorDeadlines: Map<string, number> = new Map()
  private quaiMonitorTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map()
  private processedAccessBlocks: Map<string, ReturnType<typeof setTimeout>> =
    new Map()
  private stopAddressAccessListener?: () => void

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

    this.stopAddressAccessListener = this.chainService.emitter.on(
      "addressAccessed",
      this.handleAddressAccess
    )

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
    this.stopAddressAccessListener?.()
    this.stopAddressAccessListener = undefined

    for (const timer of this.quaiMonitorTimers.values()) {
      clearTimeout(timer)
    }
    this.quaiMonitorTimers.clear()
    this.quaiMonitorDeadlines.clear()

    for (const timer of this.processedAccessBlocks.values()) {
      clearTimeout(timer)
    }
    this.processedAccessBlocks.clear()

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
    request: QuaiTransactionRequest | QuaiTransactionRequestWithAnnotation
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
      await this.processQuaiTransactionResponse(
        transactionResponse,
        "annotation" in request ? request.annotation : undefined
      )
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
            await this.chainService.syncQiWallet({ ignoreRecentSync: true })
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
      await this.saveQiTransaction(transaction)
      await this.subscribeToQiTransaction(transaction.hash)

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
          await this.chainService.syncQiWallet({ ignoreRecentSync: true })
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
    await this.subscribeToQiTransaction(transaction.hash)
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
            await this.chainService.syncQiWallet({ ignoreRecentSync: true })
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
      if (txRefundAddress) {
        await this.monitorConversion(transaction.hash, txRefundAddress, to)
      } else {
        await this.subscribeToQiTransaction(transaction.hash)
      }
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
   * Otherwise, starts a slow HTTP safety monitor for transaction confirmation.
   */
  private async checkPendingQuaiTransactions(): Promise<void> {
    const pendingTransactions = await this.db.getPendingQuaiTransactions()
    if (pendingTransactions.length <= 0) return

    await Promise.all(
      pendingTransactions.map(async ({ hash }) => {
        const confirmed = await this.confirmQuaiTransaction(hash)
        if (!confirmed) this.monitorQuaiTransaction(hash)
      })
    )
  }

  private handleAddressAccess = async ({
    address,
    blockHash,
    network,
  }: {
    address: string
    blockHash: string
    network: NetworkInterface
  }): Promise<void> => {
    const normalizedAddress = address.toLowerCase()
    const accessBlockKey = `${network.chainID}:${blockHash.toLowerCase()}:${normalizedAddress}`
    if (this.processedAccessBlocks.has(accessBlockKey)) return

    const cleanupTimer = setTimeout(() => {
      this.processedAccessBlocks.delete(accessBlockKey)
    }, PROCESSED_ACCESS_BLOCK_TTL)
    this.processedAccessBlocks.set(accessBlockKey, cleanupTimer)

    const pendingTransactions = await this.db.getPendingQuaiTransactions()
    const pendingOnNetwork = pendingTransactions.filter(
      ({ chainId, from, to }) =>
        chainId === Number(network.chainID) &&
        (from.toLowerCase() === normalizedAddress ||
          to?.toLowerCase() === normalizedAddress)
    )

    await Promise.all(
      pendingOnNetwork.map(({ hash }) => this.confirmQuaiTransaction(hash))
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
              await this.handleConversionSucceeded(
                conversion.hash,
                conversion.refundAddress!
              )
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
   * Monitors the transaction for future updates or confirmation.
   *
   * @param {QuaiTransactionResponse} transactionResponse - The response received after sending the transaction.
   */
  private async processQuaiTransactionResponse(
    transactionResponse: QuaiTransactionResponse,
    annotation?: QuaiTransactionDB["annotation"]
  ): Promise<void> {
    const transaction = quaiTransactionFromResponse(
      transactionResponse,
      TransactionStatus.PENDING,
      annotation
    )
    await this.saveQuaiTransaction(transaction)
    this.emitter.emit("transactionSend", transactionResponse.hash)
    this.monitorQuaiTransaction(transactionResponse.hash)
  }

  private async confirmQuaiTransaction(hash: string): Promise<boolean> {
    const activeRequest = this.quaiConfirmationRequests.get(hash)
    if (activeRequest) return activeRequest

    const confirmationRequest = (async () => {
      const transaction = await this.db.getQuaiTransactionByHash(hash)
      if (!transaction || transaction.status !== TransactionStatus.PENDING) {
        this.stopQuaiTransactionMonitor(hash)
        return true
      }

      try {
        const provider = this.chainService.getJsonRpcProviderForNetwork(
          transaction.chainId.toString()
        )
        const receipt = await provider.getTransactionReceipt(hash)
        if (!receipt) return false

        await this.handleQuaiTransactionReceipt(receipt)
        return true
      } catch (error: any) {
        logger.warn(
          `HTTP confirmation lookup failed for Quai transaction ${hash}: ${
            error?.message || error
          }`
        )
        return false
      }
    })()

    this.quaiConfirmationRequests.set(hash, confirmationRequest)
    try {
      return await confirmationRequest
    } finally {
      if (this.quaiConfirmationRequests.get(hash) === confirmationRequest) {
        this.quaiConfirmationRequests.delete(hash)
      }
    }
  }

  private monitorQuaiTransaction(hash: string): void {
    if (this.quaiMonitorDeadlines.has(hash)) return

    this.quaiMonitorDeadlines.set(
      hash,
      Date.now() + TRANSACTION_RECEIPT_WAIT_TIMEOUT
    )
    this.scheduleQuaiTransactionFallback(hash)
  }

  private scheduleQuaiTransactionFallback(hash: string): void {
    const timer = setTimeout(async () => {
      this.quaiMonitorTimers.delete(hash)

      const confirmed = await this.confirmQuaiTransaction(hash)
      if (confirmed) return

      const deadline = this.quaiMonitorDeadlines.get(hash)
      if (deadline && Date.now() < deadline) {
        this.scheduleQuaiTransactionFallback(hash)
        return
      }

      this.quaiMonitorDeadlines.delete(hash)
      logger.warn(
        `Unable to confirm Quai transaction ${hash}; leaving it pending`
      )
    }, QUAI_TRANSACTION_FALLBACK_INTERVAL)

    this.quaiMonitorTimers.set(hash, timer)
  }

  private stopQuaiTransactionMonitor(hash: string): void {
    const timer = this.quaiMonitorTimers.get(hash)
    if (timer) clearTimeout(timer)
    this.quaiMonitorTimers.delete(hash)
    this.quaiMonitorDeadlines.delete(hash)
  }

  private async subscribeToQiTransaction(hash: string): Promise<void> {
    let transaction = null
    const { jsonRpcProvider } = this.chainService
    const startTime = Date.now()
    const QI_TX_TIMEOUT = 5 * MINUTE

    while (!(transaction && transaction.blockNumber && transaction.blockHash)) {
      if (Date.now() - startTime > QI_TX_TIMEOUT) {
        try {
          transaction = await jsonRpcProvider.getTransaction(hash)
        } catch (error: any) {
          logger.warn(
            `Unable to perform final confirmation lookup for Qi transaction ${hash}; leaving it pending: ${
              error?.message || error
            }`
          )
          return
        }

        if (transaction && transaction.blockNumber && transaction.blockHash) {
          await this.handleQiTransaction(transaction as TransactionResponse)
        } else {
          logger.warn(`Qi transaction ${hash} timed out after 5 minutes`)
          await this.handleQiTransactionTimeout(hash)
        }
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
        transaction = null
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
    await this.chainService.syncQiWallet({ requireFreshScan: true })
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
    let refundReceived = false
    let resolved = false
    let cleanup: () => void = () => undefined

    const handleRefundAccess = async () => {
      refundReceived = true
      if (resolved) return
      resolved = true
      cleanup()
      await this.handleConversionReverted(txHash, refundAddress)
    }

    const handleRecipientAccess = async () => {
      // Brief delay to check if refund also arrives (edge case)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      if (resolved) return
      resolved = true
      cleanup()
      // If refund also received, the address got an unrelated payment — still a success
      // but don't mark refund address as unused since it has balance
      if (refundReceived) {
        await this.handleConversionSucceeded(txHash, undefined)
      } else {
        await this.handleConversionSucceeded(txHash, refundAddress)
      }
    }

    cleanup = () => {
      webSocketProvider.off(
        { type: "block", address: refundAddress },
        handleRefundAccess
      )
      webSocketProvider.off(
        { type: "block", address: quaiRecipient },
        handleRecipientAccess
      )
      this.conversionMonitors.delete(txHash)
    }

    // Subscribe to Qi refund address — if it is accessed, conversion reverted
    webSocketProvider.on(
      { type: "block", address: refundAddress },
      handleRefundAccess
    )

    // Subscribe to Quai recipient — if it is accessed, conversion likely succeeded
    webSocketProvider.on(
      { type: "block", address: quaiRecipient },
      handleRecipientAccess
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
            await this.handleConversionSucceeded(txHash, refundAddress)
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
   * Handles a successful Qi-to-Quai conversion. Marks the refund address as UNUSED
   * so it can be reused by future transactions.
   */
  private async handleConversionSucceeded(
    txHash: string,
    refundAddress: string | undefined
  ): Promise<void> {
    const transaction = await this.db.getQiTransactionByHash(txHash)
    if (!transaction) return

    transaction.status = TransactionStatus.CONFIRMED
    await this.updateQiTransaction(transaction)
    logger.info(`Conversion ${txHash} succeeded`)

    // Mark refund address as UNUSED so it can be reused
    if (refundAddress) {
      try {
        const qiWallet = await this.keyringService.getQiHDWallet()
        ;(qiWallet as any).setAddressStatus(refundAddress, QI_ADDRESS_STATUS.UNUSED)
        const serializedQiWallet = { qiHDWallet: qiWallet.serialize() }
        await this.keyringService.vaultManager.add(serializedQiWallet, {})
        logger.info(`Marked refund address ${refundAddress} as UNUSED`)
      } catch (error) {
        logger.error(`Failed to mark refund address as UNUSED:`, error)
      }
    }

    await this.chainService.syncQiWallet({ requireFreshScan: true })
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
    await this.chainService.syncQiWallet({ requireFreshScan: true })
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
    await this.chainService.syncQiWallet({ requireFreshScan: true })
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
    this.stopQuaiTransactionMonitor(receipt.hash)

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
