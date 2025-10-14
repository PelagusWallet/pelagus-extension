import TransportWebHID from "@ledgerhq/hw-transport-webhid"
import Eth from "@ledgerhq/hw-app-eth" // Modified version with protobuf support
import { 
  encodeProtoTransaction,
  hexlify,
  Signature,
  QuaiTransaction,
  keccak256
} from "quais"
import { EIP712TypedData } from "../../types"
import logger from "../../lib/logger"
import { LedgerAccountSigner } from "../keyring/types"
import { signEIP712MessageFixed } from "./eip712"


/**
 * LedgerSigner handles all signing operations for Ledger hardware wallets.
 * It acts as a drop-in replacement for the keyring signer, supporting
 * transaction signing, message signing, and typed data signing.
 */
export class LedgerSigner {
  private transport: TransportWebHID | null = null // Transport type from @ledgerhq/hw-transport
  private eth: Eth | null = null // Eth type from @ledgerhq/hw-app-eth
  private isConnected: boolean = false

  constructor() {}

  /**
   * Connect to the Ledger device
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.transport) {
      return
    }

    try {
      this.transport = await TransportWebHID.openConnected()
      this.eth = new Eth(this.transport!)
      this.isConnected = true
      logger.info("LedgerSigner: Connected to Ledger device")
    } catch (error) {
      if (error instanceof Error && error.message.includes("already open")) {
        const devices = await TransportWebHID.list()
        for (const device of devices) {
          if(device.opened) {
            device.close()
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        this.transport = await TransportWebHID.openConnected()
        this.eth = new Eth(this.transport!)
        this.isConnected = true
        logger.info("LedgerSigner: Connected to Ledger device")
        return
      }
      logger.error("LedgerSigner: Failed to connect to Ledger", error)
      throw new Error("Failed to connect to Ledger device")
    }
  }
  
  /**
   * Get the currently open app on the Ledger device
   * @returns The app name and version, or null if on dashboard
   */
  private async getCurrentApp(): Promise<{ name: string; version: string; flags: number | Buffer } | null> {
    if (!this.transport) {
      throw new Error("Transport not connected")
    }

    try {
      // Send get app and version command: 0xB0 0x01 0x00 0x00
      const response = await this.transport.send(0xb0, 0x01, 0x00, 0x00)

      let i = 0
      const format = response[i++]

      if (format !== 1) {
        throw new Error("Unsupported app version format")
      }

      const nameLength = response[i++]
      const name = response.subarray(i, i + nameLength).toString("ascii")
      i += nameLength

      const versionLength = response[i++]
      const version = response.subarray(i, i + versionLength).toString("ascii")
      i += versionLength

      const flagLength = response[i++]
      const flags = response.subarray(i, i + flagLength)

      logger.info("LedgerSigner: Current app", { name, version })
      return { name, version, flags }
    } catch (error: any) {
      // Check for disconnected device error
      if (error.name === "DisconnectedDeviceDuringOperation" || error.message?.includes("Failed to write the report")) {
        logger.warn("LedgerSigner: Transport disconnected, resetting connection")
        await this.disconnect()
        throw new Error("LEDGER_DISCONNECTED: Transport was disconnected. Please try again.")
      }

      // Error codes that indicate no app is open (on dashboard)
      if (error.statusCode === 0x6e00 || error.statusCode === 0x6d00 || error.statusCode === 0x6a82) {
        logger.info("LedgerSigner: Device is on dashboard (no app open)")
        return null
      }

      logger.error("LedgerSigner: Failed to get current app", error)
      throw error
    }
  }

  /**
   * Open the Quai app on the Ledger device
   * @throws Error if device is locked or app not found
   */
  private async openQuaiApp(): Promise<void> {
    if (!this.transport) {
      throw new Error("Transport not connected")
    }
    
    try {
      // First check what app is currently open
      const currentApp = await this.getCurrentApp()
      
      if (currentApp) {
        if (currentApp.name === "Quai") {
          logger.info("LedgerSigner: Quai app is already open")
          return // App is already open, no need to open it again
        } else {
          logger.info(`LedgerSigner: ${currentApp.name} is open, closing it first`)
          // Close current app first (quit to dashboard)
          await this.transport.send(0xb0, 0xa7, 0x00, 0x00)
          // Small delay to let device return to dashboard
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      logger.info("LedgerSigner: Opening Quai app on device")
      
      // Send the open app command: 0xE0 0xD8 0x00 0x00 + app name
      const appName = "Quai"
      const appNameBuffer = Buffer.from(appName, "ascii")
      await this.transport.send(0xe0, 0xd8, 0x00, 0x00, appNameBuffer)
      
      // Wait for app to initialize
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      logger.info("LedgerSigner: Quai app opened successfully")
    } catch (error: any) {
      // Device locked errors
      if (error.statusCode === 0x5515 || error.statusCode === 0x6983) {
        logger.error("LedgerSigner: Device is locked")
        throw new Error("LEDGER_LOCKED: Please unlock your Ledger device")
      }
      
      // User rejection
      if (error.statusCode === 0x6985) {
        logger.error("LedgerSigner: User declined to open app")
        throw new Error("USER_DECLINED: Please allow opening the Quai app on your Ledger")
      }
      
      // App not found - specific error code
      if (error.statusCode === 0x6a82) {
        logger.error("LedgerSigner: Quai app not found")
        throw new Error("APP_NOT_FOUND: Please install the Quai app on your Ledger device")
      }
      
      // Wrong app or no app errors
      if (error.statusCode === 0x6e00) {
        // Class not supported - usually means wrong app is open
        logger.info("LedgerSigner: Wrong app might be open, attempting to continue")
        return
      }
      
      // Instruction not supported - could mean app not installed
      if (error.statusCode === 0x6d00) {
        logger.error("LedgerSigner: Quai app might not be installed")
        throw new Error("APP_NOT_FOUND: Please install the Quai app on your Ledger device")
      }
      
      // Invalid data
      if (error.statusCode === 0x6984) {
        logger.error("LedgerSigner: Invalid data sent to device")
        throw new Error("INVALID_DATA: Invalid command data")
      }
      
      // App was locked
      if (error.statusCode === 0x6f04) {
        logger.error("LedgerSigner: App was locked")
        throw new Error("APP_LOCKED: The app was locked")
      }
      
      // Security not satisfied
      if (error.statusCode === 0x6982) {
        logger.error("LedgerSigner: Security not satisfied")
        throw new Error("SECURITY_ERROR: Security conditions not satisfied")
      }
      
      logger.error("LedgerSigner: Failed to open Quai app", error)
      throw error
    }
  }

  /**
   * Disconnect from the Ledger device
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close()
      this.transport = null
      this.eth = null
      this.isConnected = false
      logger.info("LedgerSigner: Disconnected from Ledger device")
    }
  }

  /**
   * Ensure the device is connected and Quai app is open before operations
   * @param expectedDevice Optional expected device info to verify we have the right device
   */
  private async ensureConnected(expectedDevice?: { deviceModel: string; deviceId: string }): Promise<Eth> {
    // If we have an expected device, check if current device matches
    if (expectedDevice && this.transport) {
      const currentDevice = this.transport.device
      const deviceMatches = 
        (currentDevice.productName === expectedDevice.deviceModel) ||
        (currentDevice.productName.includes("S+") && expectedDevice.deviceModel.includes("S Plus"))
      
      if (!deviceMatches) {
        logger.info("LedgerSigner: Different device detected, resetting connection", {
          current: currentDevice.productName,
          expected: expectedDevice.deviceModel
        })
        // Different device detected, disconnect and reconnect
        await this.disconnect()
      }
    }
    
    if (!this.isConnected || !this.eth) {
      await this.connect()
    }
    if (!this.eth) {
      throw new Error("Failed to initialize Ledger Ethereum app")
    }
    
    // Try to open the Quai app (will handle if already open)
    await this.openQuaiApp()
    
    return this.eth
  }

  /**
   * Get an address from the Ledger device
   */
  async getAddress(
    path: string,
    display: boolean = false,
    chainId?: string
  ): Promise<{ address: string; publicKey: string }> {
    const eth = await this.ensureConnected()
    const result = await eth.getAddress(path, display, false, chainId)
    return {
      address: result.address.toLowerCase(),
      publicKey: result.publicKey
    }
  }

  /**
   * Sign a Quai transaction (all transactions use protobuf encoding)
   * Returns a QuaiTransaction with the serialized signed transaction
   */
  async signQuaiTransaction(
    quaiTx: QuaiTransaction,
    accountSigner: LedgerAccountSigner
  ): Promise<QuaiTransaction & { unsignedHash: string }> {
    // Pass expected device info to ensureConnected
    await this.ensureConnected({
      deviceModel: accountSigner.deviceModel,
      deviceId: accountSigner.deviceId
    })

    // Verify we have the correct device after connection
    if(this.transport?.device.productName !== accountSigner.deviceModel && !(this.transport?.device.productName.includes("S+") && accountSigner.deviceModel.includes("S Plus"))) {
      throw new Error(`LedgerSigner: Have a ${this.transport?.device.productName} ${this.transport?.device.productId} but need a ${accountSigner.deviceModel} ${accountSigner.deviceId}`)
    }
    
    try {

      // Convert to protobuf (without signature)
      const protoTx = quaiTx.toProtobuf(false)
      const protoBytes = encodeProtoTransaction(protoTx)
      const rawTxHex = hexlify(protoBytes).slice(2) // Remove 0x prefix

      logger.info("LedgerSigner: Signing protobuf transaction", {
        path: accountSigner.path,
        zone: accountSigner.zone,
        chainId: quaiTx.chainId || 9,
        rawTxHex: rawTxHex.slice(0, 100) + "...", // First 100 chars
        txLength: rawTxHex.length
      })

      // Use our custom protobuf signing function
      const signature = await signProtoTransaction(
        this.transport,
        accountSigner.path,
        rawTxHex
      )

      // For type 0 transactions, Ledger returns v with EIP-155 encoding
      // v = chainId * 2 + 35 + parity
      // We need to extract the parity for quais.js
      const vValue = parseInt(signature.v, 10)
      const chainId = parseInt(quaiTx.chainId?.toString() || "9", 10)
      
      // Extract parity from EIP-155 encoded v value
      // parity = v - chainId * 2 - 35
      const yParity = vValue - (chainId * 2 + 35)
      
      // Validate yParity is 0 or 1
      if (yParity !== 0 && yParity !== 1) {
        throw new Error(`Invalid yParity value calculated from Ledger v=${vValue}: ${yParity}. Expected 0 or 1.`)
      }
      
      // Create signature object compatible with quais.js
      const sig = Signature.from({
        r: "0x" + signature.r,
        s: "0x" + signature.s,
        yParity: yParity as 0 | 1 // Type assertion after validation
      })

      // Calculate the hash of the unsigned transaction for verification
      const unsignedHash = keccak256(protoBytes)
      
      // Add signature to the QuaiTransaction object
      quaiTx.signature = sig

      logger.info("LedgerSigner: Transaction signed successfully")
      
      // IMPORTANT: Disconnect after signing to release the device for UI
      await this.disconnect()
      logger.info("LedgerSigner: Disconnected after signing")
      
      // Return the original QuaiTransaction with unsignedHash attached
      const signedTx = quaiTx as QuaiTransaction & { unsignedHash: string }
      signedTx.unsignedHash = unsignedHash
      return signedTx
    } catch (error: any) {
      // Handle specific error cases
      if(error instanceof Error && error.message.includes("TransportRaceCondition")) {
        await this.disconnect()
        await this.connect()
        return this.signQuaiTransaction(quaiTx, accountSigner)
      }
      
      // Handle locked device error from signing
      if (error.statusCode === 0x5515 || error.statusCode === 0x6983) {
        logger.error("LedgerSigner: Device is locked during signing")
        await this.disconnect()
        throw new Error("LEDGER_LOCKED: Please unlock your Ledger device and try again")
      }
      
      // Handle user rejection
      if (error.statusCode === 0x6985) {
        logger.error("LedgerSigner: User rejected the transaction")
        await this.disconnect()
        throw new Error("USER_REJECTED: Transaction was rejected on the Ledger device")
      }
      
      // Handle invalid data error (0x6a80)
      if (error.statusCode === 0x6a80) {
        logger.error("LedgerSigner: Invalid transaction data", {
          error: error.message,
          statusCode: error.statusCode
        })
        await this.disconnect()
        throw new Error("INVALID_DATA: Transaction data is invalid. Please ensure Contract Data is enabled in the Quai app settings on your Ledger.")
      }
      
      // Handle wrong data length
      if (error.statusCode === 0x6700) {
        logger.error("LedgerSigner: Wrong data length")
        await this.disconnect()
        throw new Error("INVALID_DATA: Wrong data length sent to device")
      }
      
      // Handle security not satisfied
      if (error.statusCode === 0x6982) {
        logger.error("LedgerSigner: Security conditions not satisfied")
        await this.disconnect()
        throw new Error("SECURITY_ERROR: Security conditions not satisfied")
      }
      
      // Handle class not supported (wrong app)
      if (error.statusCode === 0x6e00) {
        logger.error("LedgerSigner: Wrong app might be open")
        await this.disconnect()
        throw new Error("WRONG_APP: Wrong app is open on the Ledger device. Please open the Quai app.")
      }
      
      // Handle instruction not supported
      if (error.statusCode === 0x6d00) {
        logger.error("LedgerSigner: Instruction not supported")
        await this.disconnect()
        throw new Error("APP_ERROR: The Quai app might not support this operation")
      }
      
      // Handle app not found
      if (error.statusCode === 0x6a82) {
        logger.error("LedgerSigner: App not found")
        await this.disconnect()
        throw new Error("APP_NOT_FOUND: Please install the Quai app on your Ledger device")
      }
      
      // Handle invalid data (different from 0x6a80)
      if (error.statusCode === 0x6984) {
        logger.error("LedgerSigner: Invalid command data")
        await this.disconnect()
        throw new Error("INVALID_DATA: Invalid command data sent to device")
      }
      
      logger.error("LedgerSigner: Failed to sign transaction", error)
      
      // Always disconnect on error to release the device
      await this.disconnect()
      throw error
    }
  }

  /**
   * Sign a personal message
   */
  async signMessage(
    message: string | Uint8Array,
    accountSigner: LedgerAccountSigner
  ): Promise<string> {
    const eth = await this.ensureConnected({
      deviceModel: accountSigner.deviceModel,
      deviceId: accountSigner.deviceId
    })
    
    try {
      // Convert message to hex if needed
      let messageHex: string
      if (typeof message === "string") {
        if (message.startsWith("0x")) {
          messageHex = message.slice(2)
        } else {
          messageHex = Buffer.from(message, "utf8").toString("hex")
        }
      } else {
        messageHex = Buffer.from(message).toString("hex")
      }

      logger.info("LedgerSigner: Signing message", {
        path: accountSigner.path,
        messageLength: messageHex.length / 2
      })

      const signature = await eth.signPersonalMessage(
        accountSigner.path,
        messageHex
      )

      // Format the signature as expected by Ethereum
      const v = (signature.v - 27).toString(16).padStart(2, "0")
      const signatureHex = "0x" + signature.r + signature.s + v

      logger.info("LedgerSigner: Message signed successfully")
      return signatureHex
    } catch (error) {
      logger.error("LedgerSigner: Failed to sign message", error)
      throw error
    }
  }

  /**
   * Sign EIP-712 typed data
   */
  async signTypedData(
    typedData: EIP712TypedData,
    accountSigner: LedgerAccountSigner
  ): Promise<string> {
    await this.ensureConnected({
      deviceModel: accountSigner.deviceModel,
      deviceId: accountSigner.deviceId
    })
    
    try {
      // For EIP-712, we use the standard Ledger signing methods
      // since EIP-712 is not protobuf-specific
      const { domain, types, message } = typedData
        logger.info("LedgerSigner: Attempting EIP-712 message signing", {
          path: accountSigner.path
        })

        // Filter out null values from domain to match Ledger's expected type
        const ledgerDomain: Partial<{
          name: string;
          chainId: number;
          version: string;
          verifyingContract: string;
          salt: string;
        }> = {}
        
        if (domain.name !== null && domain.name !== undefined) ledgerDomain.name = domain.name
        if (domain.chainId !== null && domain.chainId !== undefined) ledgerDomain.chainId = Number(domain.chainId)
        if (domain.version !== null && domain.version !== undefined) ledgerDomain.version = domain.version
        if (domain.verifyingContract !== null && domain.verifyingContract !== undefined) {
          ledgerDomain.verifyingContract = domain.verifyingContract
        }
        if (domain.salt !== null && domain.salt !== undefined) {
          // Convert BytesLike to string (salt can be string or Uint8Array)
          if (typeof domain.salt === 'string') {
            ledgerDomain.salt = domain.salt
          } else {
            // Convert Uint8Array to hex string
            ledgerDomain.salt = hexlify(domain.salt)
          }
        }

        // Use our fixed EIP-712 implementation that properly handles P1 flags
        const signature = await signEIP712MessageFixed(
          this.transport!,
          accountSigner.path,
          {
            domain: ledgerDomain,
            types: types as any,
            message,
            primaryType: typedData.primaryType || "Message"
          }
        )

        const v = (signature.v - 27).toString(16).padStart(2, "0")
        return "0x" + signature.r + signature.s + v

    } catch (error) {
      logger.error("LedgerSigner: Failed to sign typed data", error)
      throw error
    }
  }

  /**
   * Check if the device is currently connected
   */
  isDeviceConnected(): boolean {
    return this.isConnected
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<{
    version: string
    arbitraryDataEnabled: boolean
  }> {
    const eth = await this.ensureConnected()
    const config = await eth.getAppConfiguration()
    return {
      version: config.version,
      arbitraryDataEnabled: config.arbitraryDataEnabled === 1
    }
  }
}

// Singleton instance
let ledgerSignerInstance: LedgerSigner | null = null

/**
 * Get or create the LedgerSigner singleton instance
 */
export function getLedgerSigner(): LedgerSigner {
  if (!ledgerSignerInstance) {
    ledgerSignerInstance = new LedgerSigner()
  }
  return ledgerSignerInstance
}

/**
 * Helper functions from hw-app-eth/utils
 */
function splitPath(path: string): number[] {
  const splittedPath: number[] = []
  const pathElements = path.split('/')
  
  for (const element of pathElements) {
    let value = parseInt(element, 10)
    if (element.endsWith("'")) {
      value += 0x80000000
    }
    splittedPath.push(value)
  }
  
  return splittedPath
}

function safeChunkTransaction(
  rawTx: Buffer,
  derivationPath: Buffer,
  transactionType?: number
): Buffer[] {
  const chunks: Buffer[] = []
  const maxChunkSize = 150 // Safe size for APDU chunks
  
  // First chunk includes derivation path and tx type (if present)
  const firstChunkData = transactionType !== undefined 
    ? Buffer.concat([derivationPath, Buffer.from([transactionType]), rawTx] as readonly Uint8Array[])
    : Buffer.concat([derivationPath, rawTx] as readonly Uint8Array[])
    
  // Split into chunks
  let offset = 0
  while (offset < firstChunkData.length) {
    const chunkSize = Math.min(maxChunkSize, firstChunkData.length - offset)
    chunks.push(firstChunkData.subarray(offset, offset + chunkSize) as Buffer)
    offset += chunkSize
  }
  
  return chunks
}


/**
 * Sign a protobuf-encoded transaction using the Ledger device
 * Based on hw-app-eth signTransaction but simplified for protobuf
 */
async function signProtoTransaction(
  transport: any, // Transport instance
  path: string,
  rawTxHex: string
): Promise<{
  s: string;
  v: string;
  r: string;
}> {
  enum APDU_FIELDS {
    CLA = 0xe0,
    INS = 0x04,
    P1_FIRST_CHUNK = 0x00,
    P1_FOLLOWING_CHUNK = 0x80,
    P2 = 0x00,
  }

  const rawTx = Buffer.from(rawTxHex, "hex");
  
  // Don't include transaction type for Quai protobuf transactions
  // The Quai app doesn't expect it (based on test files)
  const transactionType = undefined;

  const paths = splitPath(path);
  const derivationPathBuff = Buffer.alloc(1 + paths.length * 4);
  derivationPathBuff[0] = paths.length;
  paths.forEach((element, index) => {
    derivationPathBuff.writeUInt32BE(element, 1 + 4 * index);
  });

  const payloadChunks = safeChunkTransaction(rawTx, derivationPathBuff, transactionType);
  let response: Buffer | undefined;
  
  logger.info("Sending transaction to Ledger", {
    chunks: payloadChunks.length,
    firstChunkHex: payloadChunks[0].toString("hex").slice(0, 100) + "..."
  })
  
  for (const chunk of payloadChunks) {
    const isFirstChunk = chunk === payloadChunks[0];
    response = await transport
      .send(
        APDU_FIELDS.CLA,
        APDU_FIELDS.INS,
        isFirstChunk ? APDU_FIELDS.P1_FIRST_CHUNK : APDU_FIELDS.P1_FOLLOWING_CHUNK,
        APDU_FIELDS.P2,
        chunk,
      )
  }

  if (!response) {
    throw new Error("No response from Ledger device")
  }

  // For type 0 transactions, the Ledger returns v with EIP-155 encoding  
  // v = chainId * 2 + 35 + parity (where parity is 0 or 1)
  const v = response[0];
  const r = response.subarray(1, 1 + 32).toString("hex");
  const s = response.subarray(1 + 32, 1 + 32 + 32).toString("hex");
  return { 
    v: v.toString(), // Return the EIP-155 encoded v value as string
    r, 
    s 
  };
}

// Helper function to check if an error is a Ledger-specific error
export function isLedgerError(error: any): boolean {
  const errorMessage = error?.message || ""
  return errorMessage.includes("LEDGER_LOCKED:") ||
    errorMessage.includes("USER_REJECTED:") ||
    errorMessage.includes("APP_NOT_FOUND:") ||
    errorMessage.includes("USER_DECLINED:") ||
    errorMessage.includes("INVALID_DATA:") ||
    errorMessage.includes("APP_LOCKED:") ||
    errorMessage.includes("SECURITY_ERROR:") ||
    errorMessage.includes("WRONG_APP:") ||
    errorMessage.includes("APP_ERROR:") ||
    errorMessage.includes("LEDGER_DISCONNECTED:") ||
    errorMessage.includes("LedgerSigner:")
}