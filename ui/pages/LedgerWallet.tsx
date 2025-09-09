import React, { ReactElement, useState, useEffect } from "react"
import { useHistory, useLocation } from "react-router-dom"
import SharedDrawer from "../components/Shared/SharedDrawer"
import SharedButton from "../components/Shared/SharedButton"
import { LEDGER_VENDOR_ID } from "../utils/ledger/constants"
import { runtime } from "webextension-polyfill"

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

export default function LedgerWallet(): ReactElement {
  const history = useHistory()
  const location = useLocation<{ from?: string }>()
  const [connectedDevice, setConnectedDevice] = useState<HIDDevice | null>(null)
  const [deviceInfo, setDeviceInfo] = useState<{
    model: string
    vendorId: string
    productId: string
  } | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string>("")
  const [hidSupported, setHidSupported] = useState(true)

  useEffect(() => {
    // Check if WebHID is supported
    if (!navigator.hid) {
      setHidSupported(false)
      setError("WebHID API is not supported in your browser. Please use Chrome, Edge, or Opera.")
      return
    }

    // Check for already connected devices
    checkExistingDevices()

    // Listen for device connect/disconnect events
    const handleConnect = () => {
      checkExistingDevices()
    }
    
    const handleDisconnect = () => {
      checkExistingDevices()
    }

    navigator.hid.addEventListener("connect", handleConnect)
    navigator.hid.addEventListener("disconnect", handleDisconnect)

    // Listen for messages from background script about device updates
    const handleMessage = (message: any) => {
      if (message.type === "ledger-device-update") {
        checkExistingDevices()
      }
    }

    runtime.onMessage.addListener(handleMessage)

    return () => {
      navigator.hid.removeEventListener("connect", handleConnect)
      navigator.hid.removeEventListener("disconnect", handleDisconnect)
      runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const checkExistingDevices = async () => {
    try {
      const devices = await navigator.hid.getDevices()
      console.log("Checking existing devices, found:", devices.length)
      const ledgerDevice = devices.find((device) => device.vendorId === LEDGER_VENDOR_ID)
      
      if (ledgerDevice) {
        console.log("Found Ledger device:", ledgerDevice.productName)
        setConnectedDevice(ledgerDevice)
        setDeviceInfo({
          model: getLedgerModel(ledgerDevice.productId),
          vendorId: `0x${ledgerDevice.vendorId.toString(16)}`,
          productId: `0x${ledgerDevice.productId.toString(16)}`,
        })
      } else {
        console.log("No Ledger device found among permitted devices")
        setConnectedDevice(null)
        setDeviceInfo(null)
      }
    } catch (err) {
      console.error("Error checking devices:", err)
    }
  }

  const handleConnectLedger = async () => {
    // Open Ledger connection in a new tab where WebHID will work properly
    chrome.tabs.create({
      url: chrome.runtime.getURL("tab.html#/ledger-connect")
    })
  }

  const handleDisconnect = async () => {
    if (connectedDevice && connectedDevice.opened) {
      try {
        await connectedDevice.close()
      } catch (err) {
        console.error("Error closing device:", err)
      }
    }
    
    // Notify background script
    await runtime.sendMessage({ 
      type: "ledger-disconnect"
    })
    
    setConnectedDevice(null)
    setDeviceInfo(null)
  }

  const handleBack = () => {
    if (location.state?.from === "settings") {
      history.push("/settings")
    } else {
      history.push("/")
    }
  }

  return (
    <section className="standard_width_padded">
      <SharedDrawer
        title="Ledger Wallet Beta"
        isOpen
        close={handleBack}
        fillAvailable
        isScrollable
      >
        <div className="ledger_container">
          <div className="beta_warning">
            <div className="warning_icon">⚠️</div>
            <p className="warning_text">
              This is a beta feature. Ledger integration is currently in development and may not be fully functional.
            </p>
          </div>

          {!hidSupported ? (
            <div className="error_container">
              <p className="error_text">{error}</p>
              <p className="help_text">
                WebHID is supported in Chrome 117+, Edge, and Opera browsers.
              </p>
            </div>
          ) : (
            <>
              <div className="device_section">
                <h2>Device Status</h2>
                
                {deviceInfo ? (
                  <div className="device_info">
                    <div className="info_row">
                      <span className="label">Model:</span>
                      <span className="value">{deviceInfo.model}</span>
                    </div>
                    <div className="info_row">
                      <span className="label">Vendor ID:</span>
                      <span className="value">{deviceInfo.vendorId}</span>
                    </div>
                    <div className="info_row">
                      <span className="label">Product ID:</span>
                      <span className="value">{deviceInfo.productId}</span>
                    </div>
                    <div className="info_row">
                      <span className="label">Status:</span>
                      <span className="value connected">Connected</span>
                    </div>
                  </div>
                ) : (
                  <div className="no_device">
                    <p>No Ledger device connected</p>
                  </div>
                )}

                {error && (
                  <div className="error_message">
                    <p>{error}</p>
                  </div>
                )}
              </div>

              <div className="actions">
                <SharedButton
                  type="primary"
                  size="medium"
                  onClick={handleConnectLedger}
                >
                  Connect To Ledger
                </SharedButton>
                {connectedDevice && (
                  <SharedButton
                    type="secondary"
                    size="medium"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </SharedButton>
                )}
              </div>

              <div className="instructions">
                <h3>How to connect your Ledger:</h3>
                <ol>
                  <li>Click "Connect To Ledger" button above. </li>
                  <li>A new tab will open with the connection interface. </li>
                  <li>Follow the instructions in the new tab to connect your device. </li>
                  <li>Once connected, you can close the tab and use your Ledger wallet with Pelagus.</li>
                </ol>
                
                <div className="note">
                  <p><strong>Why a new tab?</strong></p>
                  <p className="small_text">
                    WebHID requires a full browser context for proper device access. 
                    The new tab provides the necessary permissions and security context 
                    to safely connect to your Ledger device.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </SharedDrawer>

      <style jsx>
        {`
          section {
            display: flex;
            flex-flow: column;
            height: 544px;
            background-color: var(--hunter-green);
          }

          .ledger_container {
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding: 20px 0;
          }

          .beta_warning {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid var(--attention);
            border-radius: 8px;
            padding: 16px;
            display: flex;
            gap: 12px;
            align-items: flex-start;
          }

          .warning_icon {
            font-size: 20px;
            flex-shrink: 0;
          }

          .warning_text {
            color: var(--attention);
            font-size: 14px;
            line-height: 20px;
            margin: 0;
          }

          .error_container {
            text-align: center;
            padding: 32px 16px;
          }

          .error_text {
            color: var(--error);
            font-size: 16px;
            margin-bottom: 16px;
          }

          .help_text {
            color: var(--green-40);
            font-size: 14px;
          }

          .device_section {
            background: var(--green-120);
            border-radius: 8px;
            padding: 20px;
          }

          h2 {
            color: var(--white);
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 16px 0;
          }

          h3 {
            color: var(--white);
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 12px 0;
          }

          .device_info {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .info_row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }

          .info_row:last-child {
            border-bottom: none;
          }

          .label {
            color: var(--green-40);
            font-size: 14px;
            font-weight: 500;
          }

          .value {
            color: var(--white);
            font-size: 14px;
            font-weight: 400;
          }

          .value.connected {
            color: var(--success);
            font-weight: 500;
          }

          .no_device {
            text-align: center;
            padding: 24px;
            color: var(--green-40);
            font-size: 14px;
          }

          .error_message {
            margin-top: 16px;
            padding: 12px;
            background: rgba(255, 0, 0, 0.1);
            border-radius: 4px;
          }

          .error_message p {
            color: var(--error);
            font-size: 14px;
            margin: 0;
            text-align: center;
          }

          .actions {
            display: flex;
            justify-content: center;
            gap: 12px;
          }

          .instructions {
            background: var(--green-120);
            border-radius: 8px;
            padding: 20px;
          }

          .instructions ol {
            margin: 0 0 16px 0;
            padding-left: 24px;
          }

          .instructions li {
            color: var(--green-40);
            font-size: 14px;
            line-height: 24px;
            margin-bottom: 8px;
          }

          .instructions li:last-child {
            margin-bottom: 0;
          }

          .note {
            margin-top: 16px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
          }

          .note p {
            color: var(--white);
            font-size: 14px;
            margin: 0 0 8px 0;
          }

          .note ul {
            margin: 0;
            padding-left: 20px;
          }

          .note li {
            color: var(--green-40);
            font-size: 13px;
            line-height: 20px;
            margin-bottom: 4px;
          }

          .technical_info {
            margin-top: 16px;
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
          }

          .technical_info p {
            color: var(--white);
            font-size: 13px;
            margin: 0 0 8px 0;
          }

          .technical_info p:last-child {
            margin-bottom: 0;
          }

          .small_text {
            color: var(--green-40) !important;
            font-size: 12px !important;
            line-height: 18px;
          }
        `}
      </style>
    </section>
  )
}