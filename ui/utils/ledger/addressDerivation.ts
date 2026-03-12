import { BIP44, getAddressDetails, Ledger, Zone } from "quais"
import { APDUScriptRunner } from "./APDUScriptRunner"
import { bytesToHex } from "./parseAppList"

/**
 * Check if an address is valid for Quai Ledger requirements:
 * 1. Must start with 0x00
 * 2. Must be a valid Quai address according to getAddressDetails
 */
function isValidQuaiAddress(address: string): boolean {
  try {
    // Validate with quais library - this already checks the second byte bit requirement
    const details = getAddressDetails(address)
    if (details?.ledger === Ledger.Quai && details.zone === Zone.Cyprus1) {
      return true
    }
    return false
  } catch (error) {
    // getAddressDetails throws if address is not valid Quai address
    return false
  }
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  if (hex.startsWith('0x')) {
    hex = hex.slice(2)
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Compress an uncompressed public key
 */
function compressPublicKey(pubKeyHex: string): string {
  if (pubKeyHex.startsWith("04") && pubKeyHex.length === 130) {
    // Uncompressed key (65 bytes = 130 hex chars) - compress it
    const x = pubKeyHex.slice(2, 66)
    const y = pubKeyHex.slice(66, 130)
    const yLastByte = parseInt(y.slice(-2), 16)
    const isEven = (yLastByte & 1) === 0
    return (isEven ? "02" : "03") + x
  } else if ((pubKeyHex.startsWith("02") || pubKeyHex.startsWith("03")) && pubKeyHex.length === 66) {
    // Already compressed
    return pubKeyHex
  } else {
    throw new Error(`Unexpected public key format: ${pubKeyHex.slice(0, 10)}... (length: ${pubKeyHex.length})`)
  }
}

export interface DerivedAddress {
  address: string
  publicKey: string
  path: string
  index: number
}

/**
 * Verify an address on the Ledger device screen
 * @param scriptRunner The APDU script runner connected to the device
 * @param path The full derivation path (e.g., "44'/994'/0'/0/532")
 * @param chainId The chain ID to display (default 9 for Quai)
 */
export async function verifyAddressOnDevice(
  scriptRunner: APDUScriptRunner,
  path: string,
  chainId: number = 9
): Promise<void> {
  console.log(`Requesting address verification on device for path: ${path} with chain ID ${chainId}`)

  const verifyPathComponents = path.split('/')
  const verifyPathBytes = encodeBIP32Path(path)

  // Add 8-byte big-endian chain ID
  const chainIdBytes = new Uint8Array(8)
  // Convert chain ID to big-endian 8 bytes
  for (let i = 7; i >= 0; i--) {
    chainIdBytes[i] = chainId & 0xff
    // chainId >>= 8; // Not needed for small values like 9
  }

  // Data format: [num_components] + [path_bytes] + [8-byte chain_id]
  const verifyData = new Uint8Array(1 + verifyPathBytes.length + 8)
  verifyData[0] = verifyPathComponents.length
  verifyData.set(verifyPathBytes, 1)
  verifyData.set(chainIdBytes, 1 + verifyPathBytes.length)  // Append chain ID

  // E0 02 01 00 - P1=01 (display address on device), P2=00 (no chain code needed for verification)
  const verifyCmd = "E0020100" + bytesToHex(new Uint8Array([verifyData.length])) + bytesToHex(verifyData)

  console.log(`Verification command includes chain ID: ${bytesToHex(chainIdBytes)}`)

  // Send WITHOUT SCP since we're in the Quai app context
  // Use 60 second timeout for address verification (requires user interaction)
  const result = await scriptRunner.runScript(verifyCmd, false, undefined, 60000)

  if (!result || result.length === 0 || !result[0].success) {
    throw new Error("User rejected address verification on device")
  }

  console.log("Address verified on device successfully")
}

/**
 * Close the current app and return to dashboard
 * @param scriptRunner The APDU script runner connected to the device
 * @returns Promise that resolves when back at dashboard
 */
export async function closeLedgerApp(
  scriptRunner: APDUScriptRunner
): Promise<void> {
  console.log("Closing current app and returning to dashboard...")
  
  // B0 A7 00 00 00 - Close app command
  const closeAppCmd = "B0A7000000"
  
  try {
    // Send without SCP since this might be from within an app
    const response = await scriptRunner.runScript(closeAppCmd, false)
    
    if (response && response[0] && response[0].success) {
      console.log("Returned to dashboard")
      // Wait a bit for the dashboard to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000))
    } else {
      console.log("Could not close app - might already be at dashboard")
    }
  } catch (error: any) {
    console.log("Failed to close app:", error.message)
    // Don't throw - we might already be at dashboard
  }
}

/**
 * Open an app on the Ledger device
 * @param scriptRunner The APDU script runner connected to the device
 * @param appName The name of the app to open
 * @returns Promise that resolves when the app is opened
 */
export async function openLedgerApp(
  scriptRunner: APDUScriptRunner,
  appName: string
): Promise<void> {
  console.log(`Opening ${appName} app on Ledger device...`)
  
  // Convert app name to hex
  const appNameBytes = new TextEncoder().encode(appName)
  const appNameHex = bytesToHex(appNameBytes)
  
  // E0 D8 00 00 + length + app name
  const openAppCmd = "E0D80000" + bytesToHex(new Uint8Array([appNameBytes.length])) + appNameHex
  
  try {
    // Send without SCP since this is a system command
    const response = await scriptRunner.runScript(openAppCmd, false)
    
    if (response && response[0] && response[0].success) {
      console.log(`${appName} app opened successfully`)
      // Wait a bit for the app to fully initialize
      await new Promise(resolve => setTimeout(resolve, 1000))
    } else {
      console.log(`Could not open ${appName} app - it may already be open or not installed`)
    }
  } catch (error: any) {
    // Error codes:
    // 0x6984 - App not found
    // 0x6985 - User declined
    // 0x5515 - Device is locked
    console.log(`Failed to open ${appName} app:`, error.message)
    // Don't throw - the app might already be open
  }
}

/**
 * Derive a Quai address from a Ledger device
 * @param scriptRunner The APDU script runner connected to the device
 * @param accountIndex The account index (default 0)
 * @param startIndex The starting address index to scan from (default 0)
 * @param verify Whether to display the address on the device for verification
 */
export async function deriveQuaiAddress(
  scriptRunner: APDUScriptRunner,
  accountIndex: number = 0,
  startIndex: number = 0,
  verify: boolean = true  // Default to true for security
): Promise<DerivedAddress> {
  const path = `44'/994'/${accountIndex}'`
  
  console.log(`Deriving Quai address for path: ${path}, starting from index ${startIndex}`)
  
  // First, try to open the Quai app
  await openLedgerApp(scriptRunner, "Quai")
  
  // Step 1: Get xpub (public key + chain code) from device
  // Quai app command: E0 02 00 01 - P1=00 (no display), P2=01 (with chain code)
  const pathComponents = path.split('/')
  const pathBytes = encodeBIP32Path(path)
  // Data format: [num_components] + [path_bytes]
  const data = new Uint8Array(1 + pathBytes.length)
  data[0] = pathComponents.length
  data.set(pathBytes, 1)
  const getXpubCmd = "E0020001" + bytesToHex(new Uint8Array([data.length])) + bytesToHex(data)
  
  console.log("Getting xpub from device...")
  // Send WITHOUT SCP since we're now in the Quai app context
  const xpubResponse = await scriptRunner.runScript(getXpubCmd, false)
  
  if (!xpubResponse || xpubResponse.length === 0 || !xpubResponse[0].success || !xpubResponse[0].response) {
    throw new Error("Failed to get xpub from device")
  }
  
  const xpubData = hexToBytes(xpubResponse[0].response)
  
  // Parse response: 1 byte pubkey len, pubkey, 1 byte addr len, addr, 32 bytes chain code
  const pubKeyLen = xpubData[0]
  const publicKey = xpubData.slice(1, 1 + pubKeyLen)
  const addrLen = xpubData[1 + pubKeyLen]
  // const address = xpubData.slice(2 + pubKeyLen, 2 + pubKeyLen + addrLen) // Not used, commented out
  const chainCode = xpubData.slice(2 + pubKeyLen + addrLen, 2 + pubKeyLen + addrLen + 32)
  
  const pubKeyHex = bytesToHex(publicKey)
  const chainCodeHex = bytesToHex(chainCode)
  
  console.log("Got xpub, scanning for valid Quai address...")
  
  // Step 2: Compress public key if needed
  const compressedPubKey = compressPublicKey(pubKeyHex)
  
  // Step 3: Scan for valid Quai address using BIP44.deriveChildFromPublic
  const maxIterations = 10000
  let validAddress: string | null = null
  let validIndex = -1
  let validPubKey: string | null = null
  let validPath: string | null = null
  
  const changeIndex = 0 // External chain (not change addresses)
  
  for (let i = 0; i < maxIterations; i++) {
    const currentIndex = startIndex + i
    
    try {
      // Use BIP44.deriveChildFromPublic for fast host-side derivation
      const derivedResult = BIP44.deriveChildFromPublic(
        "0x" + compressedPubKey,
        "0x" + chainCodeHex,
        accountIndex,
        changeIndex,
        currentIndex
      )
      
      if (isValidQuaiAddress(derivedResult.address)) {
        validAddress = derivedResult.address
        validIndex = currentIndex
        validPubKey = derivedResult.publicKey
        validPath = `${path}/${changeIndex}/${currentIndex}`
        console.log(`Found valid Quai address at index ${currentIndex}: ${derivedResult.address}`)
        break
      }
    } catch (error: any) {
      console.error(`Error deriving at index ${currentIndex}:`, error.message)
      // Continue to next index
    }
  }
  
  if (!validAddress || !validPubKey || !validPath) {
    throw new Error(`Could not find valid Quai address after ${maxIterations} iterations from index ${startIndex}`)
  }
  
  // Step 4: If verify is requested, ask device to display the address with chain ID
  if (verify) {
    console.log(`Requesting address verification on device for path: ${validPath} with chain ID 9`)
    
    const verifyPathComponents = validPath.split('/')
    const verifyPathBytes = encodeBIP32Path(validPath)
    
    // Add 8-byte big-endian chain ID (9) for Quai
    const chainId = 9
    const chainIdBytes = new Uint8Array(8)
    // Convert chain ID to big-endian 8 bytes
    for (let i = 7; i >= 0; i--) {
      chainIdBytes[i] = chainId & 0xff
      // chainId >>= 8; // Not needed for small values like 9
    }
    
    // Data format: [num_components] + [path_bytes] + [8-byte chain_id]
    const verifyData = new Uint8Array(1 + verifyPathBytes.length + 8)
    verifyData[0] = verifyPathComponents.length
    verifyData.set(verifyPathBytes, 1)
    verifyData.set(chainIdBytes, 1 + verifyPathBytes.length)  // Append chain ID
    
    // E0 02 01 00 - P1=01 (display address on device), P2=00 (no chain code needed for verification)
    const verifyCmd = "E0020100" + bytesToHex(new Uint8Array([verifyData.length])) + bytesToHex(verifyData)
    
    console.log(`Verification command includes chain ID: ${bytesToHex(chainIdBytes)}`)
    
    // Send WITHOUT SCP since we're in the Quai app context
    await scriptRunner.runScript(verifyCmd, false)
  }
  
  return {
    address: validAddress,
    publicKey: validPubKey,
    path: validPath,
    index: validIndex
  }
}

/**
 * Encode a BIP32 path to the format expected by Ledger devices
 */
function encodeBIP32Path(path: string): Uint8Array {
  const pathElements = path.split('/')
  const encoded = new Uint8Array(pathElements.length * 4)
  
  for (let i = 0; i < pathElements.length; i++) {
    let element = pathElements[i]
    let hardened = false
    
    if (element.endsWith("'")) {
      hardened = true
      element = element.slice(0, -1)
    }
    
    let value = parseInt(element, 10)
    if (hardened) {
      value += 0x80000000
    }
    
    // Big-endian encoding (Ledger expects big-endian)
    encoded[i * 4] = (value >> 24) & 0xff
    encoded[i * 4 + 1] = (value >> 16) & 0xff
    encoded[i * 4 + 2] = (value >> 8) & 0xff
    encoded[i * 4 + 3] = value & 0xff
  }
  
  return encoded
}