import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import SharedDrawer from "../Shared/SharedDrawer"
import { useBackgroundSelector, useBackgroundDispatch } from "../../hooks"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { 
  setCustomRPCWithRefresh, 
  resetToDefaultRPCWithRefresh 
} from "@pelagus/pelagus-background/redux-slices/networks"
import { 
  HTTPS_RPC_URL, 
  GOLDEN_AGE_HTTPS_RPC_URL, 
  ORCHARD_HTTPS_RPC_URL 
} from "@pelagus/pelagus-background/constants/networks"

interface CustomRPCModalProps {
  isOpen: boolean
  onClose: () => void
}

const CustomRPCModal: React.FC<CustomRPCModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()
  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const customRPCs = useBackgroundSelector((state) => state.networks?.customRPCs || {})
  console.log(customRPCs)
  console.log(currentNetwork)
  const [httpRpcUrl, setHttpRpcUrl] = useState("")
  const [wsRpcUrl, setWsRpcUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [httpError, setHttpError] = useState("")
  const [wsError, setWsError] = useState("")
  
  // Get the current RPC URLs - prioritize custom RPC settings over network defaults
  const chainID = Number(currentNetwork?.chainID)
  const customRPC = customRPCs[chainID]
  const { httpDefault, wsDefault } = getDefaultRPCsForNetwork(chainID)
  
  const currentHttpRPC = customRPC?.httpRpcUrl || (
    Array.isArray(currentNetwork?.jsonRpcUrls) 
      ? currentNetwork.jsonRpcUrls[0] 
      : currentNetwork?.jsonRpcUrls || httpDefault
  )
  const currentWsRPC = customRPC?.wsRpcUrl || (
    Array.isArray(currentNetwork?.webSocketRpcUrls)
      ? currentNetwork.webSocketRpcUrls[0]
      : currentNetwork?.webSocketRpcUrls || wsDefault
  )
  
  useEffect(() => {
    if (isOpen) {
      setHttpRpcUrl(currentHttpRPC)
      setWsRpcUrl(currentWsRPC)
      setHttpError("")
      setWsError("")
    }
  }, [isOpen, currentHttpRPC, currentWsRPC])
  
  const validateHttpUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === "https:" || urlObj.protocol === "http:"
    } catch {
      return false
    }
  }
  
  const validateWsUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === "wss:" || urlObj.protocol === "ws:"
    } catch {
      return false
    }
  }
  
  const handleConfirm = async () => {
    let hasError = false
    
    if (!validateHttpUrl(httpRpcUrl)) {
      setHttpError("Please enter a valid HTTP or HTTPS URL")
      hasError = true
    }
    
    if (!validateWsUrl(wsRpcUrl)) {
      setWsError("Please enter a valid WS or WSS URL")
      hasError = true
    }
    
    if (hasError) return
    
    setIsLoading(true)
    try {
      await dispatch(setCustomRPCWithRefresh({ 
        chainID: Number(currentNetwork.chainID), 
        httpRpcUrl,
        wsRpcUrl 
      }))
      onClose()
    } catch (err: any) {
      setHttpError(err?.message || "Failed to set custom RPC")
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleReset = async () => {
    setIsLoading(true)
    try {
      await dispatch(resetToDefaultRPCWithRefresh(Number(currentNetwork.chainID)))
      setHttpRpcUrl(httpDefault)
      setWsRpcUrl(wsDefault)
      setHttpError("")
      setWsError("")
    } catch (err: any) {
      setHttpError(err?.message || "Failed to reset RPC")
    } finally {
      setIsLoading(false)
    }
  }
  
  const isCustomRPC = currentHttpRPC !== httpDefault || currentWsRPC !== wsDefault
  
  return (
    <SharedDrawer
      title="Custom RPC URL"
      isOpen={isOpen}
      close={onClose}
      gap={0}
    >
      <div className="custom-rpc-modal">
        <div className="network-info">
          <span className="label">Current Network:</span>
          <span className="value">{currentNetwork?.baseAsset?.name || "Unknown"}</span>
        </div>
        
        <div className="input-group">
          <label htmlFor="http-rpc-url">HTTP/HTTPS RPC URL</label>
          <input
            id="http-rpc-url"
            type="text"
            value={httpRpcUrl}
            onChange={(e) => {
              setHttpRpcUrl(e.target.value)
              setHttpError("")
            }}
            placeholder="https://rpc.example.com"
            disabled={isLoading}
          />
          {httpError && <div className="error-message">{httpError}</div>}
        </div>
        
        <div className="input-group">
          <label htmlFor="ws-rpc-url">WS/WSS RPC URL</label>
          <input
            id="ws-rpc-url"
            type="text"
            value={wsRpcUrl}
            onChange={(e) => {
              setWsRpcUrl(e.target.value)
              setWsError("")
            }}
            placeholder="wss://rpc.example.com"
            disabled={isLoading}
          />
          {wsError && <div className="error-message">{wsError}</div>}
        </div>
        
        {isCustomRPC && (
          <div className="default-info">
            <span className="info-label">Default HTTP RPC:</span>
            <span className="info-value">{httpDefault}</span>
            <span className="info-label">Default WS RPC:</span>
            <span className="info-value">{wsDefault}</span>
          </div>
        )}
        
        <div className="button-container">
          <div className="action-buttons">
            {(httpRpcUrl !== httpDefault || wsRpcUrl !== wsDefault) && (
              <button
                type="button"
                className="reset-button"
                onClick={handleReset}
                disabled={isLoading}
              >
                Reset to Default
              </button>
            )}
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="confirm-button"
              onClick={handleConfirm}
              disabled={isLoading || !httpRpcUrl || !wsRpcUrl || (httpRpcUrl === currentHttpRPC && wsRpcUrl === currentWsRPC)}
            >
              {isLoading ? "Saving..." : "Confirm"}
            </button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .custom-rpc-modal {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px 0;
        }
        
        .network-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: var(--green-120);
          border-radius: 8px;
        }
        
        .label {
          color: var(--green-40);
          font-size: 14px;
        }
        
        .value {
          color: var(--white);
          font-size: 14px;
          font-weight: 500;
        }
        
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .input-group label {
          color: var(--white);
          font-size: 14px;
          font-weight: 500;
        }
        
        .input-group input {
          padding: 12px;
          background: var(--hunter-green);
          border: 1px solid var(--green-60);
          border-radius: 4px;
          color: var(--white);
          font-size: 14px;
          font-family: monospace;
          transition: border-color 0.2s;
        }
        
        .input-group input:focus {
          outline: none;
          border-color: var(--green-40);
        }
        
        .input-group input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .error-message {
          color: var(--error);
          font-size: 12px;
        }
        
        .default-info {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 8px 12px;
          background: var(--green-120);
          border-radius: 4px;
          border: 1px dashed var(--green-60);
        }
        
        .info-label {
          color: var(--green-40);
          font-size: 12px;
        }
        
        .info-value {
          color: var(--green-20);
          font-size: 12px;
          font-family: monospace;
        }
        
        .button-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: auto;
        }
        
        .action-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        
        .reset-button {
          padding: 10px 20px;
          background: transparent;
          border: 1px solid var(--green-40);
          color: var(--green-40);
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .reset-button:hover:not(:disabled) {
          background: var(--green-120);
        }
        
        .cancel-button {
          padding: 10px 20px;
          background: transparent;
          border: 1px solid var(--green-40);
          color: var(--green-40);
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .cancel-button:hover:not(:disabled) {
          background: var(--green-120);
        }
        
        .confirm-button {
          padding: 10px 20px;
          background: var(--green-40);
          border: none;
          color: var(--hunter-green);
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .confirm-button:hover:not(:disabled) {
          background: var(--green-20);
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </SharedDrawer>
  )
}

// Helper function to get default RPCs based on chainID
function getDefaultRPCsForNetwork(chainID: number): { httpDefault: string; wsDefault: string } {
  switch (chainID) {
    case 9:
      return { 
        httpDefault: HTTPS_RPC_URL,
        wsDefault: HTTPS_RPC_URL.replace('https://', 'wss://')
      }
    case 9000:
      return { 
        httpDefault: GOLDEN_AGE_HTTPS_RPC_URL,
        wsDefault: GOLDEN_AGE_HTTPS_RPC_URL.replace('https://', 'wss://')  
      }
    case 15000:
      return { 
        httpDefault: ORCHARD_HTTPS_RPC_URL,
        wsDefault: ORCHARD_HTTPS_RPC_URL.replace('https://', 'wss://')
      }
    case 1337:
      return { 
        httpDefault: "http://localhost:8546",
        wsDefault: "ws://localhost:8546"
      }
    default:
      return { 
        httpDefault: HTTPS_RPC_URL,
        wsDefault: HTTPS_RPC_URL.replace('https://', 'wss://')
      }
  }
}

export default CustomRPCModal