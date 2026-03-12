import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { createBackgroundAsyncThunk } from "./utils"
import logger from "../lib/logger"
import { loadAccount } from "./accounts"

export interface LedgerAddress {
  address: string
  publicKey: string
  path: string
  index: number
  deviceModel?: string  // "Flex", "Nano S Plus", etc.
  deviceId?: string     // unique identifier for the device
}

export interface LedgerState {
  isConnected: boolean
  deviceInfo: {
    vendorId: number
    productId: number
    productName: string
    deviceModel?: string  // "Flex", "Nano S Plus", etc.
    deviceId?: string     // unique identifier for the device
  } | null
  derivedAddresses: LedgerAddress[]
}

const initialState: LedgerState = {
  isConnected: false,
  deviceInfo: null,
  derivedAddresses: [],
}

const ledgerSlice = createSlice({
  name: "ledger",
  initialState,
  reducers: {
    ledgerDeviceConnected: (
      state,
      action: PayloadAction<{
        vendorId: number
        productId: number
        productName: string
      }>
    ) => {
      state.isConnected = true
      state.deviceInfo = action.payload
    },
    ledgerDeviceDisconnected: (state) => {
      state.isConnected = false
      state.deviceInfo = null
      // Keep derivedAddresses - they should persist even when device is disconnected
    },
    ledgerAddressDerived: (state, action: PayloadAction<LedgerAddress>) => {
      // Check if address already exists
      const existingIndex = state.derivedAddresses.findIndex(
        addr => addr.address === action.payload.address
      )
      if (existingIndex === -1) {
        state.derivedAddresses.push(action.payload)
      } else {
        // Update existing address
        state.derivedAddresses[existingIndex] = action.payload
      }
    },
    ledgerAddressDeleted: (state, action: PayloadAction<string>) => {
      // Remove the address from the derived addresses
      state.derivedAddresses = state.derivedAddresses.filter(
        addr => addr.address !== action.payload
      )
    },
    clearAllLedgerAddresses: (state) => {
      // Clear all derived addresses
      state.derivedAddresses = []
    },
  },
})

export const { 
  ledgerDeviceConnected, 
  ledgerDeviceDisconnected, 
  ledgerAddressDerived,
  ledgerAddressDeleted,
  clearAllLedgerAddresses
} = ledgerSlice.actions

export default ledgerSlice.reducer

// Async action to notify background service of device connection
export const connectLedgerDevice = createBackgroundAsyncThunk(
  "ledger/connectDevice",
  async (
    deviceInfo: {
      vendorId: number
      productId: number
      productName: string
    },
    { dispatch, extra: { main } }
  ) => {
    
    // Update Redux state
    dispatch(ledgerDeviceConnected(deviceInfo))
    
    return deviceInfo
  }
)

export const disconnectLedgerDevice = createBackgroundAsyncThunk(
  "ledger/disconnectDevice",
  async (_, { dispatch, extra: { main } }) => {
    
    // Update Redux state
    dispatch(ledgerDeviceDisconnected())
  }
)

// Async action to store derived address
export const storeLedgerAddress = createBackgroundAsyncThunk(
  "ledger/storeAddress",
  async (addressData: LedgerAddress, { dispatch, extra: { main } }) => {
    // Add the address to be tracked by the chain service and signing service
    if (addressData.deviceModel && addressData.deviceId) {
      await main.addLedgerAccount(
        addressData.address,
        addressData.deviceModel,
        addressData.deviceId,
        addressData.path
      )
      
      // Trigger account loading to update UI immediately
      const network = main.chainService.supportedNetworks.find(n => n.chainID === "9")
      if (network) {
        dispatch(loadAccount({ address: addressData.address, network }))
      }
    }
    
    // Store the address in Redux state
    dispatch(ledgerAddressDerived(addressData))

    logger.info("Stored ledger address:", addressData)
    
    return addressData
  }
)

// Async action to delete a Ledger address
export const deleteLedgerAddress = createBackgroundAsyncThunk(
  "ledger/deleteAddress",
  async (address: string, { dispatch, extra: { main } }) => {
    // Remove the address from tracking
    await main.removeLedgerAccount(address)
    
    // Remove from Redux state
    dispatch(ledgerAddressDeleted(address))
    
    logger.info("Deleted ledger address:", address)
    
    return address
  }
)

// Async action to clear all Ledger addresses
export const deleteAllLedgerAddresses = createBackgroundAsyncThunk(
  "ledger/deleteAllAddresses",
  async (_, { dispatch, extra: { main }, getState }) => {
    const state = getState() as { ledger: LedgerState }
    const addresses = state.ledger.derivedAddresses
    
    // Remove all addresses from tracking
    for (const addr of addresses) {
      await main.removeLedgerAccount(addr.address)
    }
    
    // Clear from Redux state
    dispatch(clearAllLedgerAddresses())
    
    logger.info("Cleared all ledger addresses")
    
    return true
  }
)

// Async action to sign a test transaction with Ledger
export const signLedgerTestTransaction = createBackgroundAsyncThunk(
  "ledger/signTestTransaction",
  async (
    {
      transaction,
      address,
      path
    }: {
      transaction: any
      address: string
      path: string
    },
    { extra: { main } }
  ) => {
    logger.info("Signing test transaction for Ledger address:", { address, path })
    
    // Sign the transaction using the signing service
    const result = await main.signLedgerTestTransaction(transaction, address, path)
    
    return result
  }
)