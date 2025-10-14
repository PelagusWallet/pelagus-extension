import React, { ReactElement, useState, useEffect } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useBackgroundDispatch } from "../hooks/redux-hooks"
import { useTheme } from "../hooks"
import { LEDGER_VENDOR_ID } from "../utils/ledger/constants"
import { APDUScriptRunner } from "../utils/ledger/APDUScriptRunner"
import { parseAppList, bytesToHex } from "../utils/ledger/parseAppList"
import { deriveQuaiAddress, DerivedAddress, openLedgerApp, closeLedgerApp, verifyAddressOnDevice } from "../utils/ledger/addressDerivation"
import SharedButton from "../components/Shared/SharedButton"
import SharedLoadingSpinner from "../components/Shared/SharedLoadingSpinner"
import {
  connectLedgerDevice,
  disconnectLedgerDevice,
  storeLedgerAddress,
  deleteLedgerAddress,
  deleteAllLedgerAddresses,
  signLedgerTestTransaction,
  LedgerAddress
} from "@pelagus/pelagus-background/redux-slices/ledger"
import { RootState } from "@pelagus/pelagus-background/redux-slices"
import { recoverAddress } from "quais"

// Device model detection based on product ID
const getLedgerModel = (productId: number): string => {
  switch (productId) {
    case 0x0001:
    case 0x1000:
      return "Nano S"
    case 0x0004:
    case 0x4000:
      return "Nano X"
    case 0x0005:
    case 0x5000:
      return "Nano S Plus"
    case 0x0006:
    case 0x6000:
      return "Stax"
    case 0x0007:
    case 0x7000:
      return "Flex"
    default:
      return `Unknown (0x${productId.toString(16)})`
  }
}

interface InstalledApp {
  name: string
  hash?: string
}

export default function LedgerConnect(): ReactElement {
  useTheme()

  const dispatch = useDispatch()
  const backgroundDispatch = useBackgroundDispatch()
  const derivedAddresses = useSelector((state: RootState) => state.ledger.derivedAddresses)

  const [connectedDevice, setConnectedDevice] = useState<HIDDevice | null>(null)
  const [deviceInfo, setDeviceInfo] = useState<{
    model: string
    vendorId: string
    productId: string
    targetId?: number
  } | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string>("")
  const [hidSupported, setHidSupported] = useState(true)
  const [scriptRunner, setScriptRunner] = useState<APDUScriptRunner | null>(null)
  const [scpInitialized, setScpInitialized] = useState(false)
  const [isInitializingScp, setIsInitializingScp] = useState(false)
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([])
  const [isLoadingApps, setIsLoadingApps] = useState(false)
  const [deletingApp, setDeletingApp] = useState<string | null>(null)
  const [isInstallingQuai, setIsInstallingQuai] = useState(false)
  const [installProgress, setInstallProgress] = useState(0)
  const [showTroubleshooting, setShowTroubleshooting] = useState(false)
  const [scpRetryCount, setScpRetryCount] = useState(0)
  
  // Address derivation state
  const [isDeriving, setIsDeriving] = useState(false)
  const [derivedAddress, setDerivedAddress] = useState<DerivedAddress | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  
  // Test transaction state
  const [testingAddress, setTestingAddress] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{ [address: string]: { success: boolean, message: string } }>({})
  const [signingTransaction, setSigningTransaction] = useState(false)

  useEffect(() => {
    // Check if WebHID is supported
    if (!navigator.hid) {
      setHidSupported(false)
      setError("WebHID API is not supported in your browser. Please use Chrome 117+, Edge, or Opera.")
      return
    }

    // Check for already connected devices
    checkExistingDevices()

    // Remove automatic reconnection - it interferes with test transactions
    // when we need to release device control for the background service
  }, [])
  
  // Clean up script runner on unmount in a separate effect
  useEffect(() => {
    return () => {
      if (scriptRunner) {
        scriptRunner.disconnect()
      }
    }
  }, [scriptRunner])

  // Auto-list apps when SCP is initialized
  useEffect(() => {
    if (scpInitialized && scriptRunner) {
      console.log("SCP initialized, auto-listing apps...")
      handleListApps()
    }
  }, [scpInitialized])

  const checkExistingDevices = async () => {
    try {
      const devices = await navigator.hid.getDevices()
      console.log("Checking existing devices, found:", devices.length)
      const ledgerDevice = devices.find((device) => device.vendorId === LEDGER_VENDOR_ID)
      
      if (ledgerDevice) {
        console.log("Found Ledger device:", ledgerDevice.productName)
        setConnectedDevice(ledgerDevice)
        
        // Initialize script runner for existing device
        try {
          // Ensure device is open
          if (!ledgerDevice.opened) {
            await ledgerDevice.open()
          }
          
          const runner = new APDUScriptRunner()
          await runner.connect()
          
          // Get device target ID with GET_VERSION command
          const getVersionCmd = "E001000000"  // CLA INS P1 P2 Le (5 bytes)
          const result = await runner.runScript(getVersionCmd)
          
          let targetId: number | undefined
          
          if (result.length > 0 && result[0].success && result[0].response) {
            const response = hexToBytes(result[0].response)
            targetId = (response[0] << 24) | (response[1] << 16) | (response[2] << 8) | response[3]
            
            setDeviceInfo({
              model: getLedgerModel(ledgerDevice.productId),
              vendorId: `0x${ledgerDevice.vendorId.toString(16)}`,
              productId: `0x${ledgerDevice.productId.toString(16)}`,
              targetId: targetId
            })
          } else {
            setDeviceInfo({
              model: getLedgerModel(ledgerDevice.productId),
              vendorId: `0x${ledgerDevice.vendorId.toString(16)}`,
              productId: `0x${ledgerDevice.productId.toString(16)}`,
            })
          }
          
          setScriptRunner(runner)
          console.log("Script runner initialized for existing device")
          
          // Auto-initialize SCP if we have targetId
          if (targetId) {
            setTimeout(async () => {
              try {
                // First close any open app to return to dashboard
                console.log("Ensuring we're at dashboard before SCP...")
                await closeLedgerApp(runner)
                
                // Re-get target ID after closing app as it might have changed
                console.log("Re-fetching target ID after app closure...")
                const getVersionCmd = "E001000000"
                const versionResult = await runner.runScript(getVersionCmd)
                
                let newTargetId = targetId // fallback to original
                if (versionResult.length > 0 && versionResult[0].success && versionResult[0].response) {
                  const response = hexToBytes(versionResult[0].response)
                  newTargetId = (response[0] << 24) | (response[1] << 16) | (response[2] << 8) | response[3]
                  console.log("New target ID after app closure:", `0x${newTargetId.toString(16)}`)
                  
                  // Update device info with new target ID
                  setDeviceInfo(prev => prev ? { ...prev, targetId: newTargetId } : prev)
                }
                
                console.log("Auto-initializing SCP with target ID:", `0x${newTargetId?.toString(16)}`)
                const success = await initializeScpWithRetry(runner, newTargetId!)
                if (success) {
                  setScpInitialized(true)
                  console.log("SCP auto-initialized successfully")
                  
                  // Auto-list apps after successful SCP
                  handleListApps()
                }
              } catch (err: any) {
                console.error("Failed to auto-initialize SCP:", err)
                // Don't show error for timeout since we already retried
              }
            }, 500)
          }
        } catch (err) {
          console.error("Error initializing script runner for existing device:", err)
          setDeviceInfo({
            model: getLedgerModel(ledgerDevice.productId),
            vendorId: `0x${ledgerDevice.vendorId.toString(16)}`,
            productId: `0x${ledgerDevice.productId.toString(16)}`,
          })
        }
      } else {
        console.log("No Ledger device found among permitted devices")
        setConnectedDevice(null)
        setDeviceInfo(null)
        setScriptRunner(null)
        setScpInitialized(false)
        setInstalledApps([])
      }
    } catch (err) {
      console.error("Error checking devices:", err)
    }
  }

  const handleConnectLedger = async () => {
    setIsConnecting(true)
    setError("")

    try {
      console.log("Requesting HID device access from tab context...")
      
      // Request device - this should work properly in a full tab context
      const devices = await navigator.hid.requestDevice({
        filters: [{ vendorId: LEDGER_VENDOR_ID }]
      })

      if (devices.length === 0) {
        console.log("No device selected by user")
        setError("")
        setIsConnecting(false)
        return
      }

      const device = devices[0]
      console.log("Device selected:", device.productName)
      
      // Notify background service via Redux dispatch
      dispatch(connectLedgerDevice({
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName || ""
      }))
      
      // Try to open the device
      if (!device.opened) {
        try {
          await device.open()
          console.log("Device opened successfully")
        } catch (openError: any) {
          console.error("Failed to open device:", openError)
          if (!openError.message?.includes("already open")) {
            setError("Failed to open device. Make sure it's unlocked and no other app is using it.")
            setIsConnecting(false)
            return
          }
        }
      }

      // Get device target ID
      const runner = new APDUScriptRunner()
      await runner.connect()
      
      // Get device info with GET_VERSION command
      const getVersionCmd = "E001000000"  // CLA INS P1 P2 Le (5 bytes)
      const result = await runner.runScript(getVersionCmd)
      
      let targetId: number | undefined
      
      if (result.length > 0 && result[0].success && result[0].response) {
        const response = hexToBytes(result[0].response)
        // Parse target ID (first 4 bytes, big-endian)
        targetId = (response[0] << 24) | (response[1] << 16) | (response[2] << 8) | response[3]
        
        setDeviceInfo({
          model: getLedgerModel(device.productId),
          vendorId: `0x${device.vendorId.toString(16)}`,
          productId: `0x${device.productId.toString(16)}`,
          targetId: targetId
        })
      } else {
        setDeviceInfo({
          model: getLedgerModel(device.productId),
          vendorId: `0x${device.vendorId.toString(16)}`,
          productId: `0x${device.productId.toString(16)}`,
        })
      }
      
      setScriptRunner(runner)
      setConnectedDevice(device)

      console.log(`Successfully connected to ${device.productName}`)
      
      // Auto-initialize SCP if we have targetId
      if (targetId) {
        setTimeout(async () => {
          try {
            // First close any open app to return to dashboard
            console.log("Ensuring we're at dashboard before SCP...")
            await closeLedgerApp(runner)
            
            // Re-get target ID after closing app as it might have changed
            console.log("Re-fetching target ID after app closure...")
            const getVersionCmd = "E001000000"
            const versionResult = await runner.runScript(getVersionCmd)
            
            let newTargetId = targetId // fallback to original
            if (versionResult.length > 0 && versionResult[0].success && versionResult[0].response) {
              const response = hexToBytes(versionResult[0].response)
              newTargetId = (response[0] << 24) | (response[1] << 16) | (response[2] << 8) | response[3]
              console.log("New target ID after app closure:", `0x${newTargetId.toString(16)}`)
              
              // Update device info with new target ID
              setDeviceInfo({
                model: getLedgerModel(device.productId),
                vendorId: `0x${device.vendorId.toString(16)}`,
                productId: `0x${device.productId.toString(16)}`,
                targetId: newTargetId
              })
            }
            
            console.log("Auto-initializing SCP with target ID:", `0x${newTargetId!.toString(16)}`)
            const success = await initializeScpWithRetry(runner, newTargetId!)
            if (success) {
              setScpInitialized(true)
              console.log("SCP auto-initialized successfully")
            }
          } catch (err: any) {
            console.error("Failed to auto-initialize SCP:", err)
            // Don't show error for timeout since we already retried
          }
        }, 500)
      }
    } catch (err: any) {
      console.error("Connection error:", err)
      
      if (err.name === "NotAllowedError") {
        setError("Permission denied. Please allow access to your Ledger device when prompted.")
      } else if (err.name === "SecurityError") {
        setError("Security error: WebHID requires a user gesture. Please click the button again.")
      } else if (err.message?.includes("No device selected")) {
        // User cancelled - don't show error
        setError("")
      } else {
        setError(err.message || "Failed to connect to Ledger device")
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleInitializeSCP = async () => {
    if (!scriptRunner || !deviceInfo?.targetId) return
    
    setIsInitializingScp(true)
    setError("")
    
    try {
      // First close any open app to return to dashboard
      console.log("Ensuring we're at dashboard before SCP...")
      await closeLedgerApp(scriptRunner)
      
      // Re-get target ID after closing app as it might have changed
      console.log("Re-fetching target ID after app closure...")
      const getVersionCmd = "E001000000"
      const versionResult = await scriptRunner.runScript(getVersionCmd)
      
      let newTargetId = deviceInfo.targetId
      if (versionResult.length > 0 && versionResult[0].success && versionResult[0].response) {
        const response = hexToBytes(versionResult[0].response)
        newTargetId = (response[0] << 24) | (response[1] << 16) | (response[2] << 8) | response[3]
        console.log("New target ID after app closure:", `0x${newTargetId.toString(16)}`)
        
        // Update device info with new target ID
        setDeviceInfo(prev => prev ? { ...prev, targetId: newTargetId } : prev)
      }
      
      console.log("Initializing Secure Channel Protocol with target ID:", `0x${newTargetId.toString(16)}`)
      
      // Initialize SCP with the refreshed target ID and retry logic
      const success = await initializeScpWithRetry(scriptRunner, newTargetId)
      
      if (success) {
        setScpInitialized(true)
        console.log("SCP initialized successfully")
        // Apps will be listed automatically via useEffect
      } else {
        setError("Failed to initialize Secure Channel after multiple attempts. Please ensure your device is unlocked, refresh the page and try again.")
      }
    } catch (err: any) {
      console.error("SCP initialization error:", err)
      setError(err.message || "Failed to initialize Secure Channel")
    } finally {
      setIsInitializingScp(false)
    }
  }

  const handleListApps = async () => {
    if (!scriptRunner || !scpInitialized) return
    
    setIsLoadingApps(true)
    setError("")
    
    try {
      console.log("Listing installed apps...")
      
      let allAppData = new Uint8Array()
      let isFirstCall = true
      
      // Keep calling LIST_APPS / LIST_APPS_CONTINUE until we get empty response
      while (true) {
        // List apps command: 0x0E for first call, 0x0F for continue
        const listCmd = isFirstCall ? "E0000000010E" : "E0000000010F"
        const result = await scriptRunner.runScript(listCmd, true) // true = use SCP
        
        if (result.length > 0 && result[0].success && result[0].response) {
          const response = hexToBytes(result[0].response)
          
          // Check status word
          const sw = (response[response.length - 2] << 8) | response[response.length - 1]
          if (sw !== 0x9000) {
            console.log(`List apps failed with SW: 0x${sw.toString(16).padStart(4, '0')}`)
            break
          }
          
          // Remove status word to get data
          const responseData = response.slice(0, -2)
          
          console.log(`${isFirstCall ? 'First' : 'Continue'} response length: ${responseData.length}`)
          
          // If empty response, we're done
          if (responseData.length === 0) {
            console.log('Got empty response, done listing apps')
            break
          }
          
          // Append to accumulated data
          if (isFirstCall) {
            allAppData = new Uint8Array(responseData)
          } else {
            // Concatenate data
            const newData = new Uint8Array(allAppData.length + responseData.length)
            newData.set(allAppData)
            newData.set(responseData, allAppData.length)
            allAppData = newData
          }
          
          isFirstCall = false
        } else {
          console.log("Failed to get response or error in command")
          break
        }
      }
      
      console.log('Total app data length:', allAppData.length)
      
      // Parse complete app list
      if (allAppData.length > 0) {
        const apps = parseAppList(allAppData)
        console.log("Found apps:", apps)
        setInstalledApps(apps.map(name => ({ name })))
      } else {
        console.log("No apps found")
        setInstalledApps([])
      }
    } catch (err: any) {
      console.error("Error listing apps:", err)
      setError("Failed to list apps: " + err.message)
    } finally {
      setIsLoadingApps(false)
    }
  }

  const handleDeleteApp = async (appName: string) => {
    if (!scriptRunner || !scpInitialized) return
    
    setDeletingApp(appName)
    setError("")
    
    try {
      console.log(`Deleting app: ${appName}`)
      
      // Create delete app command
      // Format: 0x0C (delete) + length + app name
      const appNameBytes = new TextEncoder().encode(appName)
      const command = new Uint8Array([0x0C, appNameBytes.length, ...appNameBytes])
      const commandHex = bytesToHex(command)
      
      // Wrap in APDU format: E0 00 00 00 + length + command
      const apduHex = `E0000000${command.length.toString(16).padStart(2, '0')}${commandHex}`
      
      const result = await scriptRunner.runScript(apduHex, true) // true = use SCP
      
      if (result.length > 0 && result[0].response) {
        // Parse the response to check status word
        const response = hexToBytes(result[0].response)
        const sw = (response[response.length - 2] << 8) | response[response.length - 1]
        
        if (sw === 0x9000) {
          console.log(`App ${appName} deleted successfully`)
          // Refresh app list
          await handleListApps()
        } else if (sw === 0x6985) {
          setError(`Delete denied by user for ${appName}`)
        } else {
          setError(`Failed to delete ${appName}. Status: 0x${sw.toString(16).padStart(4, '0')}`)
        }
      } else {
        setError(`Failed to delete ${appName}. No response from device.`)
      }
    } catch (err: any) {
      console.error(`Error deleting app ${appName}:`, err)
      setError(`Failed to delete ${appName}: ${err.message}`)
    } finally {
      setDeletingApp(null)
    }
  }

  const handleInstallQuai = async () => {
    if (!scriptRunner || !scpInitialized || !deviceInfo) return
    
    setIsInstallingQuai(true)
    setInstallProgress(0)
    setError("")
    
    try {
      console.log(`Installing Quai app for ${deviceInfo.model}...`)
      
      // Determine which APDU file to use based on device model
      let apduFile = ""
      if (deviceInfo.model === "Flex") {
        apduFile = "/ledger-apps/quai-flex.apdu"
      } else if (deviceInfo.model == "Stax") {
        apduFile = "/ledger-apps/quai-stax.apdu"
      } else if (deviceInfo.model === "Nano S" || deviceInfo.model === "Nano S Plus") {
        apduFile = "/ledger-apps/quai-nanos2.apdu"
      } else {
        setError(`Unsupported device model: ${deviceInfo.model}`)
        setIsInstallingQuai(false)
        return
      }
      
      console.log(`Loading APDU file: ${apduFile}`)
      
      // Fetch the APDU file
      const response = await fetch(chrome.runtime.getURL(apduFile))
      if (!response.ok) {
        throw new Error(`Failed to load APDU file: ${response.statusText}`)
      }
      
      const apduContent = await response.text()
      const apduCommands = apduContent.split('\n').filter(line => line.trim() && !line.startsWith('#'))
      
      console.log(`Found ${apduCommands.length} APDU commands`)
      
      // Run each APDU command
      let commandNum = 0
      for (const apduHex of apduCommands) {
        commandNum++
        
        // Update progress
        const progress = Math.floor((commandNum / apduCommands.length) * 100)
        setInstallProgress(progress)
        
        if (commandNum % 100 === 0 || commandNum === 1) {
          console.log(`Installing Quai app... Progress: ${commandNum}/${apduCommands.length}`)
        }
        
        // Parse the APDU hex string
        const cleanHex = apduHex.trim().replace(/\s+/g, '')
        if (cleanHex.length < 10) continue // Skip invalid lines
        
        // Build APDU command for script runner
        // Use 60 second timeout for app installation (can take time for user interaction)
        const result = await scriptRunner.runScript(cleanHex, true, undefined, 60000) // Use SCP
        
        if (result.length > 0 && result[0].response) {
          const response = hexToBytes(result[0].response)
          const sw = (response[response.length - 2] << 8) | response[response.length - 1]
          
          if (sw !== 0x9000 && sw !== 0x6a80 && sw !== 0x6985) {
            // Some commands may return different status codes during installation
            if (sw === 0x6d00 || sw === 0x6e00) {
              throw new Error(`Installation failed at command ${commandNum}: SW ${sw.toString(16).padStart(4, '0')}`)
            }
          }
          
          if (sw === 0x6985) {
            throw new Error("Installation denied by user")
          }
        }
      }
      
      console.log("Quai app installed successfully!")
      setError("")
      
      // Refresh app list
      await handleListApps()
      
    } catch (err: any) {
      console.error("Error installing Quai app:", err)
      setError(`Failed to install Quai app: ${err.message}`)
    } finally {
      setIsInstallingQuai(false)
      setInstallProgress(0)
    }
  }

  const handleDeriveAddress = async () => {
    if (!scriptRunner || !scpInitialized || !deviceInfo) {
      setError("Device not ready for address derivation")
      return
    }

    setIsDeriving(true)
    setIsVerified(false)
    setError("")

    try {
      // Calculate the next account index based on saved addresses for this device
      const deviceId = `${deviceInfo.vendorId}-${deviceInfo.productId}`
      const deviceAddresses = derivedAddresses.filter(addr => addr.deviceId === deviceId)
      const nextAccountIndex = deviceAddresses.length

      // Step 1: Derive address without device verification
      const address = await deriveQuaiAddress(
        scriptRunner,
        nextAccountIndex,
        0,  // Start from index 0
        false // Don't verify yet - we'll show it first
      )

      setDerivedAddress(address)
      console.log("Derived address:", address)

      // Step 2: Immediately start verification on device
      setIsDeriving(false)
      setIsVerifying(true)

      try {
        await verifyAddressOnDevice(scriptRunner, address.path, 9)
        setIsVerified(true)
        console.log("Address verified on device")
      } catch (verifyErr: any) {
        console.error("Address verification failed:", verifyErr)
        setError(`Address verification failed: ${verifyErr.message}`)
        // Keep the address visible but mark as not verified
      } finally {
        setIsVerifying(false)
      }
    } catch (err: any) {
      console.error("Failed to derive address:", err)
      setError(`Failed to derive address: ${err.message}`)
      setIsDeriving(false)
    }
  }

  const handleSaveAddress = () => {
    if (!derivedAddress || !deviceInfo || !isVerified) return

    // Create the device model string (e.g., "Flex", "Nano S Plus")
    const deviceModel = deviceInfo.model

    // Create a unique device ID from vendor and product IDs
    const deviceId = `${deviceInfo.vendorId}-${deviceInfo.productId}`

    // Dispatch action to store address in backend with device info
    const addressWithDevice = {
      ...derivedAddress,
      deviceModel,
      deviceId,
    }

    dispatch(storeLedgerAddress(addressWithDevice))

    // Clear the current derived address and verification state
    setDerivedAddress(null)
    setIsVerified(false)
    console.log("Address saved to wallet with device info:", deviceModel)
  }

  const handleTestTransaction = async (address: string, path: string) => {
    if (!connectedDevice) {
      setTestResults(prev => ({
        ...prev,
        [address]: { success: false, message: "Device not connected" }
      }))
      return
    }

    setTestingAddress(address)
    setSigningTransaction(true)
    
    try {
      // First, ensure Quai app is open on the device
      if (scriptRunner && scpInitialized) {
        console.log("Opening Quai app on Ledger...")
        await openLedgerApp(scriptRunner, "Quai")
      }
      
      // IMPORTANT: Release the device connection so background can use it
      console.log("Releasing device connection for background service...")
      if (scriptRunner) {
        await scriptRunner.disconnect()
        setScriptRunner(null)
      }
      if (connectedDevice && connectedDevice.opened) {
        await connectedDevice.close()
        console.log("Device connection closed in UI")
      }
      
      // Create a test transaction
      const testTx = {
        type: 0,
        from: address,
        to: address, // Send to self
        value: "0",
        gasPrice: "1000000000", // 1 gwei
        gasLimit: "21000",
        nonce: 0,
        chainId: 9,
        data: "0x"
      }
      
      console.log("Creating test transaction:", testTx)
      
      // Call background service to sign the transaction
      const result = await backgroundDispatch(signLedgerTestTransaction({
        transaction: testTx,
        address,
        path
      })) as { serialized: string; signature: any; hash: string } | undefined
      
      if (!result) {
        throw new Error("No result from signing operation")
      }
      
      const { serialized, signature, hash } = result
      
      console.log("Transaction signed:", { serialized, signature, hash })
      
      // Verify the signature by recovering the address
      try {
        // For protobuf transactions, verify the signature
        const recoveredAddress = recoverAddress(hash, signature)
        
        console.log("Recovered address:", recoveredAddress)
        console.log("Expected address:", address)
        
        const isValid = recoveredAddress.toLowerCase() === address.toLowerCase()
        
        setTestResults(prev => ({
          ...prev,
          [address]: {
            success: isValid,
            message: isValid 
              ? `✓ Signature valid! Recovered: ${recoveredAddress.slice(0, 10)}...`
              : `✗ Signature invalid! Expected ${address.slice(0, 10)}... but got ${recoveredAddress.slice(0, 10)}...`
          }
        }))
      } catch (verifyError: any) {
        console.error("Signature verification error:", verifyError)
        setTestResults(prev => ({
          ...prev,
          [address]: {
            success: false,
            message: `Verification failed: ${verifyError.message}`
          }
        }))
      }
    } catch (error: any) {
      console.error("Test transaction error:", error)
      setTestResults(prev => ({
        ...prev,
        [address]: {
          success: false,
          message: error.message || "Failed to sign test transaction"
        }
      }))
    } finally {
      // Reconnect to the device after test
      console.log("Reconnecting to device after test...")
      try {
        // Create a new script runner and connect to the device
        // Give the device a moment to stabilize
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        const runner = new APDUScriptRunner()
        const connected = await runner.connect()
        
        if (!connected) {
          throw new Error("Failed to reconnect to device")
        }
        
        setScriptRunner(runner)
        console.log("Script runner reconnected")
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Reuse the existing SCP initialization logic
        await handleInitializeSCP()
      } catch (reconnectError) {
        console.error("Failed to reconnect to device:", reconnectError)
        setScriptRunner(null)
        setScpInitialized(false)
        // User may need to manually reconnect by clicking Connect again
      }
      
      setTestingAddress(null)
      setSigningTransaction(false)
    }
  }

  const handleDisconnect = async () => {
    if (scriptRunner) {
      try {
        await scriptRunner.disconnect()
      } catch (err) {
        console.error("Error disconnecting:", err)
      }
      setScriptRunner(null)
    }
    
    if (connectedDevice && connectedDevice.opened) {
      try {
        await connectedDevice.close()
      } catch (err) {
        console.error("Error closing device:", err)
      }
    }
    
    // Notify background service via Redux dispatch
    dispatch(disconnectLedgerDevice())
    
    setConnectedDevice(null)
    setDeviceInfo(null)
    setScpInitialized(false)
    setInstalledApps([])
  }

  function hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/\s/g, '')
    const bytes = new Uint8Array(clean.length / 2)
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i/2] = parseInt(clean.substring(i, i+2), 16)
    }
    return bytes
  }

  // Helper function to initialize SCP with retry logic
  const initializeScpWithRetry = async (runner: APDUScriptRunner, targetId: number, maxRetries = 3): Promise<boolean> => {
    let attempt = 0
    
    while (attempt < maxRetries) {
      try {
        console.log(`SCP initialization attempt ${attempt + 1}/${maxRetries}...`)
        const success = await runner.initializeSCP(targetId)
        
        if (success) {
          console.log("SCP initialized successfully")
          setScpRetryCount(0)
          return true
        }
      } catch (err: any) {
        console.error(`SCP initialization attempt ${attempt + 1} failed:`, err)
        
        // Check for timeout error specifically
        if (err.message?.includes("Response timeout") || err.message?.includes("Failed to auto-initialize SCP")) {
          attempt++
          setScpRetryCount(attempt)
          
          if (attempt < maxRetries) {
            console.log(`Retrying SCP initialization in 2 seconds...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            continue
          }
        }
        
        // For non-timeout errors, don't retry
        throw err
      }
      
      attempt++
    }
    
    console.error(`Failed to initialize SCP after ${maxRetries} attempts`)
    setScpRetryCount(0)
    return false
  }

  return (
    <div className="ledger_connect_container">
      <div className="header">
        <h1>Ledger Device Manager</h1>
        <p className="subtitle">Connect and manage your Ledger hardware wallet</p>
      </div>

      {!hidSupported ? (
        <div className="error_container">
          <div className="error_icon">⚠️</div>
          <p className="error_text">{error}</p>
          <p className="help_text">
            WebHID is supported in Chrome 117+, Edge, and Opera browsers.
          </p>
        </div>
      ) : (
        <>
          <div className="main_content">
            <div className="device_section">
              <h2>Device Status</h2>
              
              {deviceInfo ? (
                <div className="device_info">
                  <div className="connected_badge">
                    <span className="badge_icon">✓</span>
                    Connected
                  </div>
                  <div className="info_grid">
                    <div className="info_item">
                      <span className="label">Model</span>
                      <span className="value">{deviceInfo.model}</span>
                    </div>
                    <div className="info_item">
                      <span className="label">Vendor ID</span>
                      <span className="value">{deviceInfo.vendorId}</span>
                    </div>
                    <div className="info_item">
                      <span className="label">Product ID</span>
                      <span className="value">{deviceInfo.productId}</span>
                    </div>
                    {deviceInfo.targetId && (
                      <div className="info_item">
                        <span className="label">Target ID</span>
                        <span className="value">0x{deviceInfo.targetId.toString(16).padStart(8, '0')}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="no_device">
                  <div className="device_icon">🔌</div>
                  <p>No Ledger device connected</p>
                  <p className="hint">Click the button below to connect your device</p>
                </div>
              )}

              {error && (
                <div className="error_message">
                  <p>{error}</p>
                </div>
              )}
            </div>

            {connectedDevice && !scpInitialized && (
              <div className="scp_section">
                <div className="scp_loading_container">
                  <SharedLoadingSpinner size="large" />
                  <p className="scp_loading">
                    Initializing secure channel with your device...
                  </p>
                  <p className="scp_instruction">
                    Please approve the connection on your Ledger device when prompted
                  </p>
                  {scpRetryCount > 0 && (
                    <p className="scp_retry">
                      Retry attempt {scpRetryCount}/3...
                    </p>
                  )}
                </div>
              </div>
            )}

            {scpInitialized && (
              <div className="apps_section">
                <div className="apps_header">
                  <h2>Installed Apps</h2>
                  <SharedButton
                    type="tertiary"
                    size="small"
                    onClick={handleListApps}
                    isDisabled={isLoadingApps}
                    isLoading={isLoadingApps}
                  >
                    Refresh
                  </SharedButton>
                </div>
                
                {isLoadingApps ? (
                  <div className="loading_apps">Loading apps...</div>
                ) : installedApps.length > 0 ? (
                  <div className="apps_list">
                    {installedApps.map((app) => (
                      <div key={app.name} className="app_item">
                        <span className="app_name">{app.name}</span>
                        <SharedButton
                          type="tertiary"
                          size="small"
                          onClick={() => handleDeleteApp(app.name)}
                          isDisabled={deletingApp !== null}
                          isLoading={deletingApp === app.name}
                        >
                          {deletingApp === app.name ? "Deleting..." : "Delete"}
                        </SharedButton>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no_apps">No apps found on device</div>
                )}
                
                {/* Show Install Quai button if Quai is not installed */}
                {!isLoadingApps && !installedApps.some(app =>
                  app.name.toLowerCase() === 'quai'
                ) && (
                  <div className="install_quai_section">
                    <p className="install_quai_message">
                      {isInstallingQuai
                        ? "Do not close your browser or navigate away from this page while the Quai app is installing."
                        : "Quai app is not installed on your device."}
                    </p>
                    {!isInstallingQuai ? (
                      <SharedButton
                        type="primary"
                        size="medium"
                        onClick={handleInstallQuai}
                        isDisabled={isInstallingQuai || !scpInitialized}
                      >
                        Install Quai App
                      </SharedButton>
                    ) : (
                      <div className="install_progress_container">
                        <div className="progress_bar_container">
                          <div className="progress_bar" style={{ width: `${installProgress}%` }}>
                            <span className="progress_text">{installProgress}%</span>
                          </div>
                        </div>
                        <p className="install_status">
                          Installing Quai app... {installProgress}% complete
                        </p>
                        <p className="install_note">
                          Please follow the prompts on your Ledger device
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="apps_note">
                  <p><strong>Note:</strong> Deleting apps requires approval on your Ledger device.</p>
                </div>
              </div>
            )}

            {/* Address Derivation Section */}
            {scpInitialized && installedApps.some(app => app.name.toLowerCase() === "quai") && (
              <div className="address_section">
                <div className="section_header">
                  <h3>Create Account</h3>
                  {derivedAddresses.length > 0 && (
                    <SharedButton
                      type="tertiary"
                      size="small"
                      onClick={() => {
                        if (window.confirm('This will clear all saved Ledger addresses. Are you sure?')) {
                          dispatch(deleteAllLedgerAddresses())
                        }
                      }}
                      style={{ color: '#ff9900' }}
                    >
                      Reset All Addresses
                    </SharedButton>
                  )}
                </div>

                {deviceInfo && (() => {
                  const deviceId = `${deviceInfo.vendorId}-${deviceInfo.productId}`
                  const deviceAddresses = derivedAddresses.filter(addr => addr.deviceId === deviceId)
                  const nextAccountIndex = deviceAddresses.length

                  return (
                    <div className="account_index_info">
                      <p>
                        Next account index: {nextAccountIndex}
                      </p>
                    </div>
                  )
                })()}

                <SharedButton
                  type="primary"
                  size="medium"
                  onClick={handleDeriveAddress}
                  isDisabled={isDeriving || !scriptRunner || !scpInitialized}
                  isLoading={isDeriving}
                >
                  {isDeriving ? "Deriving..." : "Add Quai Account"}
                </SharedButton>

                {derivedAddress && (
                  <div className="derived_address_box">
                    <p><strong>Address:</strong> {derivedAddress.address}</p>
                    <p><strong>Path:</strong> {derivedAddress.path}</p>
                    <p><strong>Index:</strong> {derivedAddress.index}</p>

                    {isVerifying && (
                      <div className="verification_status verifying">
                        <SharedLoadingSpinner size="small" />
                        <span>Please confirm the address on your Ledger device...</span>
                      </div>
                    )}

                    {!isVerifying && isVerified && (
                      <div className="verification_status verified">
                        <span className="check_icon">✓</span>
                        <span>Address verified on device</span>
                      </div>
                    )}

                    {!isVerifying && !isVerified && error.includes("verification") && (
                      <div className="verification_status rejected">
                        <span className="error_icon">✗</span>
                        <span>Verification rejected or failed</span>
                      </div>
                    )}

                    <SharedButton
                      type="secondary"
                      size="small"
                      onClick={handleSaveAddress}
                      isDisabled={!isVerified || isVerifying}
                      style={{ marginTop: '10px' }}
                    >
                      Save to Wallet
                    </SharedButton>
                  </div>
                )}

                {derivedAddresses.length > 0 && (
                  <div className="saved_addresses_section">
                    <div className="section_header">
                      <h4>Saved Addresses:</h4>
                      <SharedButton
                        type="tertiary"
                        size="small"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to remove all Ledger addresses?')) {
                            dispatch(deleteAllLedgerAddresses())
                          }
                        }}
                        style={{ color: '#ff4444' }}
                      >
                        Clear All
                      </SharedButton>
                    </div>
                    {(() => {
                      // Group addresses by device
                      const addressesByDevice = derivedAddresses.reduce((acc, addr) => {
                        const deviceKey = `${addr.deviceModel || 'Unknown'}-${addr.deviceId || 'unknown'}`
                        if (!acc[deviceKey]) {
                          acc[deviceKey] = {
                            deviceModel: addr.deviceModel || 'Unknown',
                            addresses: []
                          }
                        }
                        acc[deviceKey].addresses.push(addr)
                        return acc
                      }, {} as Record<string, { deviceModel: string, addresses: LedgerAddress[] }>)
                      
                      return Object.entries(addressesByDevice).map(([deviceKey, deviceData]) => (
                        <div key={deviceKey} className="device_group">
                          <h5 className="device_group_title">
                            {deviceData.deviceModel} {deviceData.addresses.length > 0 ? `(${deviceData.addresses.length})` : ''}
                          </h5>
                          {deviceData.addresses.map((addr, i) => (
                            <div key={i} className="address_item">
                              <div className="address_item_content">
                                <div className="address_info">
                                  <p className="address_text">{addr.address}</p>
                                  <p className="path_text">Path: {addr.path}</p>
                                </div>
                                <div className="address_actions">
                                  <SharedButton
                                    type="tertiary"
                                    size="small"
                                    onClick={() => dispatch(deleteLedgerAddress(addr.address))}
                                    style={{
                                      color: '#ff4444',
                                      minWidth: '70px'
                                    }}
                                  >
                                    Delete
                                  </SharedButton>
                                </div>
                              </div>
                              {testResults[addr.address] && (
                                <div className={`test_result ${testResults[addr.address].success ? 'success' : 'error'}`}>
                                  {testResults[addr.address].message}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>
            )}

            <div className="actions">
              {!connectedDevice ? (
                <SharedButton
                  type="primary"
                  size="large"
                  onClick={handleConnectLedger}
                  isDisabled={isConnecting}
                  isLoading={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect Ledger"}
                </SharedButton>
              ) : (
                <>
                  <SharedButton
                    type="secondary"
                    size="large"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </SharedButton>
                  {scpInitialized && (
                    <SharedButton
                      type="primary"
                      size="large"
                      onClick={() => window.close()}
                    >
                      Done
                    </SharedButton>
                  )}
                </>
              )}
            </div>

            {/* Troubleshooting dropdown */}
            {connectedDevice && (
              <div className="troubleshooting_section">
                <button
                  className="troubleshooting_button"
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                >
                  <span>Troubleshooting</span>
                  <span className={`arrow ${showTroubleshooting ? 'open' : ''}`}>▼</span>
                </button>

                {showTroubleshooting && (
                  <div className="troubleshooting_content">
                    <p className="troubleshooting_text">
                      If you're experiencing issues, you can manually initialize the secure channel:
                    </p>
                    <SharedButton
                      type="tertiary"
                      size="small"
                      onClick={handleInitializeSCP}
                      isDisabled={isInitializingScp || !scriptRunner || scpInitialized}
                      isLoading={isInitializingScp}
                    >
                      {isInitializingScp ? "Initializing..." : scpInitialized ? "Secure Channel Active" : "Initialize Secure Channel"}
                    </SharedButton>
                    <p className="troubleshooting_note">
                      This will require approval on your Ledger device.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!connectedDevice && (
              <div className="instructions">
                <h3>Before you connect:</h3>
                <ol>
                  <li>
                    <span className="step_icon">1</span>
                    Connect your Ledger device to your computer via USB
                  </li>
                  <li>
                    <span className="step_icon">2</span>
                    Unlock your Ledger device with your PIN
                  </li>
                  <li>
                    <span className="step_icon">3</span>
                    Navigate to the dashboard (main menu)
                  </li>
                  <li>
                    <span className="step_icon">4</span>
                    Click the "Connect Ledger" button above
                  </li>
                </ol>
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .ledger_connect_container {
          min-height: 100vh;
          background: linear-gradient(180deg, #1668e5 0%, #ffffff 100%);
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        :global([data-theme="dark"]) .ledger_connect_container {
          background: linear-gradient(180deg, var(--hunter-green) 0%, var(--green-120) 100%);
        }

        .header {
          text-align: center;
          margin-bottom: 40px;
        }

        h1 {
          color: var(--primary-text);
          font-size: 32px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .subtitle {
          color: rgba(255, 255, 255, 0.9);
          font-size: 16px;
          margin: 0;
        }

        .main_content {
          width: 100%;
          max-width: 700px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .device_section, .scp_section, .apps_section {
          background: var(--primary-bg);
          border-radius: 16px;
          padding: 32px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-light);
        }

        :global([data-theme="dark"]) .device_section,
        :global([data-theme="dark"]) .scp_section,
        :global([data-theme="dark"]) .apps_section {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        h2 {
          color: var(--primary-text);
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 24px 0;
        }

        h3 {
          color: var(--primary-text);
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }

        .device_info {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .connected_badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(0, 255, 0, 0.1);
          color: var(--success);
          padding: 8px 16px;
          border-radius: 24px;
          font-size: 14px;
          font-weight: 600;
          align-self: flex-start;
        }

        .badge_icon {
          font-size: 16px;
        }

        .info_grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
        }

        .info_item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .label {
          color: var(--secondary-text);
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .value {
          color: var(--primary-text);
          font-size: 16px;
          font-weight: 400;
        }

        .no_device {
          text-align: center;
          padding: 40px 20px;
        }

        .device_icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .no_device p {
          color: var(--primary-text);
          font-size: 16px;
          margin: 0 0 8px 0;
        }

        .hint {
          color: var(--secondary-text) !important;
          font-size: 14px !important;
        }

        .error_container {
          background: rgba(255, 0, 0, 0.1);
          border: 1px solid var(--error);
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          max-width: 500px;
        }

        .error_icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .error_text {
          color: var(--error);
          font-size: 16px;
          margin: 0 0 8px 0;
        }

        .help_text {
          color: var(--secondary-text);
          font-size: 14px;
          margin: 0;
        }

        .error_message {
          background: rgba(255, 0, 0, 0.1);
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 16px;
        }

        .error_message p {
          color: var(--error);
          font-size: 14px;
          margin: 0;
        }

        .scp_info {
          color: var(--secondary-text);
          font-size: 14px;
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .apps_header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .apps_header h2 {
          margin: 0;
        }

        .loading_apps, .no_apps {
          text-align: center;
          color: var(--secondary-text);
          padding: 20px;
          font-size: 14px;
        }

        .apps_list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .app_item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--secondary-bg);
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid var(--border-light);
        }

        :global([data-theme="dark"]) .app_item {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .app_name {
          color: var(--primary-text);
          font-size: 15px;
          font-weight: 500;
        }

        .apps_note {
          margin-top: 20px;
          padding: 12px;
          background: rgba(255, 193, 7, 0.1);
          border-radius: 8px;
        }

        .apps_note p {
          color: var(--attention);
          font-size: 13px;
          margin: 0;
        }

        .actions {
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        .instructions {
          background: var(--primary-bg);
          border-radius: 16px;
          padding: 32px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-light);
        }

        :global([data-theme="dark"]) .instructions {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .instructions ol {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .instructions li {
          color: var(--primary-text);
          font-size: 14px;
          line-height: 24px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .instructions li:last-child {
          margin-bottom: 0;
        }

        .step_icon {
          background: var(--accent-color);
          color: var(--white);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        /* Address Section Styles */
        .address_section {
          background: var(--primary-bg);
          border-radius: 16px;
          padding: 32px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-light);
          margin-bottom: 20px;
        }

        :global([data-theme="dark"]) .address_section {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .section_header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .section_header h3,
        .section_header h4 {
          margin: 0;
        }

        .account_index_info {
          margin-bottom: 15px;
        }

        .account_index_info p {
          fontSize: 14px;
          color: var(--secondary-text);
          margin: 0 0 10px 0;
        }

        .derived_address_box {
          margin-top: 15px;
          padding: 15px;
          background: var(--secondary-bg);
          border-radius: 8px;
          word-break: break-all;
        }

        :global([data-theme="dark"]) .derived_address_box {
          background: rgba(255, 255, 255, 0.05);
        }

        .derived_address_box p {
          color: var(--primary-text);
          margin: 5px 0;
        }

        .verification_status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          margin-top: 10px;
          border-radius: 6px;
          font-size: 14px;
        }

        .verification_status.verifying {
          background: rgba(23, 117, 228, 0.1);
          color: var(--accent-color);
          border: 1px solid var(--accent-color);
        }

        :global([data-theme="dark"]) .verification_status.verifying {
          background: rgba(23, 117, 228, 0.2);
        }

        .verification_status.verified {
          background: rgba(28, 175, 78, 0.1);
          color: var(--success);
          border: 1px solid var(--success);
        }

        :global([data-theme="dark"]) .verification_status.verified {
          background: rgba(28, 175, 78, 0.2);
        }

        .verification_status.rejected {
          background: rgba(255, 102, 102, 0.1);
          color: var(--error);
          border: 1px solid var(--error);
        }

        :global([data-theme="dark"]) .verification_status.rejected {
          background: rgba(255, 102, 102, 0.2);
        }

        .check_icon {
          font-size: 18px;
          font-weight: bold;
        }

        .error_icon {
          font-size: 18px;
          font-weight: bold;
        }

        .saved_addresses_section {
          margin-top: 20px;
        }

        .device_group {
          margin-bottom: 20px;
        }

        .device_group_title {
          margin: 10px 0 10px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--primary-text);
        }

        .address_item {
          padding: 10px;
          margin-top: 10px;
          background: var(--secondary-bg);
          border: 1px solid var(--border-light);
          border-radius: 5px;
          font-size: 14px;
        }

        :global([data-theme="dark"]) .address_item {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .address_item_content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .address_info {
          flex: 1;
        }

        .address_text {
          margin: 0 0 5px 0;
          word-break: break-all;
          color: var(--primary-text);
        }

        .path_text {
          font-size: 12px;
          color: var(--secondary-text);
          margin: 0;
        }

        .address_actions {
          display: flex;
          gap: 10px;
        }

        .test_result {
          margin-top: 10px;
          padding: 8px;
          border-radius: 4px;
          font-size: 13px;
        }

        .test_result.success {
          background: rgba(28, 175, 78, 0.1);
          color: var(--success);
        }

        :global([data-theme="dark"]) .test_result.success {
          background: rgba(28, 175, 78, 0.2);
        }

        .test_result.error {
          background: rgba(255, 102, 102, 0.1);
          color: var(--error);
        }

        :global([data-theme="dark"]) .test_result.error {
          background: rgba(255, 102, 102, 0.2);
        }

        /* Install Quai Section */
        .install_quai_section {
          margin-top: 20px;
          padding: 20px;
          border: 1px solid var(--border-light);
          border-radius: 8px;
          background: var(--secondary-bg);
        }

        :global([data-theme="dark"]) .install_quai_section {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .install_quai_message {
          margin-bottom: 15px;
          color: var(--primary-text);
        }

        .install_progress_container {
          width: 100%;
        }

        .progress_bar_container {
          width: 100%;
          height: 30px;
          background: var(--secondary-bg);
          border: 1px solid var(--border-light);
          border-radius: 15px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        :global([data-theme="dark"]) .progress_bar_container {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .progress_bar {
          height: 100%;
          background: linear-gradient(90deg, #1668e5 0%, #4789ec 100%);
          transition: width 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .progress_text {
          color: white;
          font-weight: bold;
          font-size: 14px;
        }

        .install_status {
          text-align: center;
          margin-bottom: 10px;
          color: var(--primary-text);
        }

        .install_note {
          font-size: 12px;
          color: var(--secondary-text);
          text-align: center;
        }

        /* SCP Loading Section */
        .scp_loading_container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
          gap: 15px;
        }

        .scp_loading {
          font-size: 16px;
          font-weight: 500;
          margin-bottom: 10px;
          color: var(--primary-text);
        }

        .scp_instruction {
          font-size: 14px;
          color: var(--secondary-text);
          text-align: center;
        }

        .scp_retry {
          font-size: 12px;
          color: var(--attention);
          text-align: center;
          margin-top: 5px;
        }

        /* Troubleshooting Section */
        .troubleshooting_section {
          margin-top: 20px;
        }

        .troubleshooting_button {
          background: var(--primary-bg);
          border: 1px solid var(--border-light);
          padding: 10px;
          border-radius: 5px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          font-size: 14px;
          color: var(--primary-text);
        }

        :global([data-theme="dark"]) .troubleshooting_button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .troubleshooting_button:hover {
          background: var(--secondary-bg);
        }

        :global([data-theme="dark"]) .troubleshooting_button:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .arrow {
          transform: rotate(0deg);
          transition: transform 0.3s;
        }

        .arrow.open {
          transform: rotate(180deg);
        }

        .troubleshooting_content {
          margin-top: 10px;
          padding: 15px;
          border: 1px solid var(--border-light);
          border-radius: 5px;
          background: var(--secondary-bg);
        }

        :global([data-theme="dark"]) .troubleshooting_content {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .troubleshooting_text {
          margin-bottom: 15px;
          font-size: 13px;
          color: var(--secondary-text);
        }

        .troubleshooting_note {
          margin-top: 10px;
          font-size: 12px;
          color: var(--secondary-text);
        }
      `}</style>
    </div>
  )
}