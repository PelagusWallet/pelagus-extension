import { AccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import React, { ReactElement, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useHistory } from "react-router-dom"
import {
  confirmPassword,
  exportPrivKey,
  exportPrivKeyEncryptedJSON,
} from "@pelagus/pelagus-background/redux-slices/keyrings"
import { useAreKeyringsUnlocked, useBackgroundDispatch } from "../../hooks"
import SharedDropdown from "../Shared/SharedDropDown"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import AccountItemEditName from "./AccountItemEditName"
import AccountItemRemovalConfirm from "./AccountItemRemovalConfirm"
import AccountitemOptionLabel from "./AccountItemOptionLabel"
import AccountHistoryRemovalConfirm from "./AccountHistoryRemovalConfirm"
import SharedBanner from "../Shared/SharedBanner"
import { addToOffscreenClipboardSensitiveData } from "../../../src/offscreen"
import ExportPasswordPrompt from "./ExportPasswordPrompt"

type ExportMode = "plaintext" | "encrypted" | null

type AccountItemOptionsMenuProps = {
  accountTotal: AccountTotal
  moveAccountUp: (address: string, signerId: string) => void
  moveAccountDown: (address: string, signerId: string) => void
  signerId: string | null
}

export default function AccountItemOptionsMenu({
  accountTotal,
  moveAccountUp,
  moveAccountDown,
  signerId,
}: AccountItemOptionsMenuProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "accounts.accountItem",
  })
  const { t: tAccounts } = useTranslation("translation", {
    keyPrefix: "accounts",
  })
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const { address, network } = accountTotal
  const [showAddressRemoveConfirm, setShowAddressRemoveConfirm] =
    useState(false)
  const [key, setKey] = useState("")
  const [showExportPrivateKey, setShowExportPrivateKey] = useState(false)
  const [showEditName, setShowEditName] = useState(false)
  const [showClearTXHistory, setShowClearTXHistory] = useState(false)
  const [showExportOptions, setShowExportOptions] = useState(false)
  const [encryptPassword, setEncryptPassword] = useState("")
  const [showEncryptPasswordModal, setShowEncryptPasswordModal] = useState(false)
  const [showWalletPasswordModal, setShowWalletPasswordModal] = useState(false)
  const [walletPassword, setWalletPassword] = useState("")
  const [confirmedWalletPassword, setConfirmedWalletPassword] = useState("")
  const [walletPasswordError, setWalletPasswordError] = useState("")
  const [exportMode, setExportMode] = useState<ExportMode>(null)

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(address)
    dispatch(setSnackbarConfig({ message: "Address copied to clipboard" }))
  }, [address, dispatch])

  const copyPrivateKey = async () => {
    await addToOffscreenClipboardSensitiveData(key)
    dispatch(setSnackbarConfig({ message: "Key copied to clipboard" }))
  }

  const onClosePrivateKeyModal = () => {
    setKey("")
    setShowExportPrivateKey(false)
  }

  const resetWalletPasswordPrompt = () => {
    setWalletPassword("")
    setConfirmedWalletPassword("")
    setWalletPasswordError("")
    setExportMode(null)
    setShowWalletPasswordModal(false)
  }

  const openWalletPasswordPrompt = (mode: Exclude<ExportMode, null>) => {
    setShowExportOptions(false)
    setWalletPassword("")
    setWalletPasswordError("")
    setConfirmedWalletPassword("")
    setExportMode(mode)
    setShowWalletPasswordModal(true)
  }

  const handleWalletPasswordSubmit = async () => {
    if (!walletPassword) return

    if (exportMode === "plaintext") {
      const result = (await dispatch(
        exportPrivKey({ password: walletPassword, address })
      )) as
        | ReturnType<typeof exportPrivKey.fulfilled>
        | ReturnType<typeof exportPrivKey.rejected>

      if (exportPrivKey.fulfilled.match(result) && result.payload.key) {
        setKey(result.payload.key)
        setShowExportPrivateKey(true)
        resetWalletPasswordPrompt()
        return
      }

      setWalletPasswordError("Incorrect wallet password")
      return
    }

    if (exportMode === "encrypted") {
      const result = (await dispatch(confirmPassword(walletPassword))) as
        | ReturnType<typeof confirmPassword.fulfilled>
        | ReturnType<typeof confirmPassword.rejected>

      if (!confirmPassword.fulfilled.match(result) || !result.payload.success) {
        setWalletPasswordError("Incorrect wallet password")
        return
      }

      setConfirmedWalletPassword(walletPassword)
      setWalletPassword("")
      setWalletPasswordError("")
      setShowWalletPasswordModal(false)
      setShowEncryptPasswordModal(true)
    }
  }

  const handleExportEncrypted = async () => {
    if (!encryptPassword || !confirmedWalletPassword) return

    const result = (await dispatch(
      exportPrivKeyEncryptedJSON({
        walletPassword: confirmedWalletPassword,
        password: encryptPassword,
        address,
      })
    )) as
      | ReturnType<typeof exportPrivKeyEncryptedJSON.fulfilled>
      | ReturnType<typeof exportPrivKeyEncryptedJSON.rejected>

    if (!exportPrivKeyEncryptedJSON.fulfilled.match(result) || !result.payload.key) {
      setWalletPasswordError("Incorrect wallet password")
      setShowEncryptPasswordModal(false)
      setShowWalletPasswordModal(true)
      return
    }

    const encryptedKey = result.payload.key

    // Create a download link for the encrypted JSON
    const blob = new Blob([encryptedKey], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `account-${address.substring(0, 8)}-encrypted.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setEncryptPassword("")
    setConfirmedWalletPassword("")
    setShowEncryptPasswordModal(false)
    setExportMode(null)
    dispatch(
      setSnackbarConfig({
        message: "Encrypted key file downloaded",
        duration: 5000,
      })
    )
  }

  const handleWalletPasswordChange = (value: string) => {
    setWalletPassword(value)
    if (walletPasswordError) {
      setWalletPasswordError("")
    }
  }

  const closeEncryptPasswordModal = () => {
    setShowEncryptPasswordModal(false)
    setEncryptPassword("")
    setConfirmedWalletPassword("")
    setExportMode(null)
  }

  return (
    <div className="options_menu_wrap">
      <SharedSlideUpMenu
        size="custom"
        customSize="304px"
        isOpen={showEditName}
        close={(e) => {
          e?.stopPropagation()
          setShowEditName(false)
        }}
      >
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "default" }}
        >
          <AccountItemEditName
            addressOnNetwork={{ address, network }}
            account={accountTotal}
            close={() => setShowEditName(false)}
          />
        </div>
      </SharedSlideUpMenu>
      <SharedSlideUpMenu
        size="custom"
        customSize="336px"
        isOpen={showAddressRemoveConfirm}
        close={(e) => {
          e?.stopPropagation()
          setShowAddressRemoveConfirm(false)
        }}
      >
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "default" }}
        >
          <AccountItemRemovalConfirm
            account={accountTotal}
            close={() => setShowAddressRemoveConfirm(false)}
          />
        </div>
      </SharedSlideUpMenu>
      <SharedSlideUpMenu
        size="custom"
        customSize="336px"
        isOpen={showClearTXHistory}
        close={(e) => {
          e?.stopPropagation()
          setShowClearTXHistory(false)
        }}
      >
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "default" }}
        >
          <AccountHistoryRemovalConfirm
            account={accountTotal}
            close={() => setShowClearTXHistory(false)}
          />
        </div>
      </SharedSlideUpMenu>
      <SharedSlideUpMenu
        size="custom"
        customSize="235px"
        isOpen={showExportPrivateKey}
        close={(e) => {
          e?.stopPropagation()
          onClosePrivateKeyModal()
        }}
      >
        <li className="account_container">
          <div className="item-summary">
            <div title="Private Key" className="address_name">
              Private Key
            </div>
            <text style={{ marginTop: "18px" }}>{key}</text>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              copyPrivateKey()
            }}
            style={{ margin: "10px 0" }}
          >
            <AccountitemOptionLabel
              icon="icons/s/copy.svg"
              label="Copy Key"
              hoverable
              color="var(--secondary-text)"
              hoverColor="var(--green-20)"
            />
          </button>

          <SharedBanner
            icon="notif-attention"
            iconColor="var(--error-80)"
            customStyles="background: var(--error); width: 100%; box-sizing: border-box;"
          >
            <span className="warning_message">
              {tAccounts("copyPrivateKeyWarning")}
            </span>
          </SharedBanner>
        </li>
      </SharedSlideUpMenu>
      <SharedSlideUpMenu
        size="custom"
        customSize="336px"
        isOpen={showWalletPasswordModal}
        close={(e) => {
          e?.stopPropagation()
          resetWalletPasswordPrompt()
        }}
      >
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "default" }}
        >
          <ExportPasswordPrompt
            title="Confirm Wallet Password"
            description="Re-enter your wallet password before exporting private key material."
            password={walletPassword}
            errorMessage={walletPasswordError}
            confirmLabel={exportMode === "encrypted" ? "Continue" : "Export"}
            onPasswordChange={handleWalletPasswordChange}
            onConfirm={handleWalletPasswordSubmit}
            onBack={() => {
              resetWalletPasswordPrompt()
              setShowExportOptions(true)
            }}
          />
        </div>
      </SharedSlideUpMenu>
      
      {/* Export Options Modal */}
      <SharedSlideUpMenu
        size="custom"
        customSize="200px"
        isOpen={showExportOptions}
        close={(e) => {
          e?.stopPropagation()
          setShowExportOptions(false)
        }}
      >
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "default" }}
        >
          <li className="account_container">
            <div className="item-summary">
              <div className="address_name">Export Account</div>
              <div className="export_options">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openWalletPasswordPrompt("plaintext")
                  }}
                  className="export_option_button"
                >
                  <AccountitemOptionLabel
                    icon="icons/s/key.svg"
                    label="Export as Plaintext"
                    hoverable
                    color="var(--green-20)"
                    hoverColor="var(--white)"
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openWalletPasswordPrompt("encrypted")
                  }}
                  className="export_option_button"
                >
                  <AccountitemOptionLabel
                    icon="icons/s/lock.svg"
                    label="Export as Encrypted JSON"
                    hoverable
                    color="var(--green-20)"
                    hoverColor="var(--white)"
                  />
                </button>
              </div>
            </div>
          </li>
        </div>
      </SharedSlideUpMenu>
      
      {/* Encrypt Password Modal */}
      <SharedSlideUpMenu
        size="custom"
        customSize="336px"
        isOpen={showEncryptPasswordModal}
        close={(e) => {
          e?.stopPropagation()
          closeEncryptPasswordModal()
        }}
      >
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "default" }}
        >
          <ExportPasswordPrompt
            title="Encrypt Private Key"
            description="Choose a password for the exported JSON file."
            password={encryptPassword}
            confirmLabel="Export"
            onPasswordChange={(value) => setEncryptPassword(value)}
            onConfirm={handleExportEncrypted}
            onBack={() => {
              setShowEncryptPasswordModal(false)
              setEncryptPassword("")
              setShowWalletPasswordModal(true)
            }}
          />
        </div>
      </SharedSlideUpMenu>
      
      <SharedDropdown
        toggler={(toggle) => (
          <button
            type="button"
            className="icon_settings"
            role="menu"
            onClick={() => toggle()}
            tabIndex={0}
          />
        )}
        options={[
          {
            key: "edit",
            icon: "icons/s/edit.svg",
            label: t("editName"),
            onClick: () => {
              setShowEditName(true)
            },
          },
          {
            key: "copy",
            icon: "icons/s/copy.svg",
            label: t("copyAddress"),
            onClick: () => {
              copyAddress()
            },
          },
          {
            key: "export",
            icon: "icons/s/add.svg",
            label: t("exportAccount"),
            onClick: async () => {
              if (areKeyringsUnlocked) {
                setShowExportOptions(true)
              } else {
                history.push("/keyring/unlock")
              }
            },
          },
          {
            key: "moveUp",
            icon: "icons/s/arrow-up.svg",
            label: t("moveUp"),
            onClick: () => {
              if (signerId != null) moveAccountUp(address, signerId)
            },
          },
          {
            key: "moveDown",
            icon: "icons/s/arrow-down.svg",
            label: t("moveDown"),
            onClick: () => {
              if (signerId != null) moveAccountDown(address, signerId)
            },
          },
          {
            key: "clearHistory",
            icon: "garbage@2x.png",
            label: t("clearHistory"),
            onClick: () => {
              setShowClearTXHistory(true)
            },
            color: "var(--error)",
            hoverColor: "var(--error-80)",
          },
        ]}
      />

      <style jsx>
        {`
          .icon_settings {
            mask-image: url("./images/more_dots@2x.png");
            mask-repeat: no-repeat;
            mask-position: center;
            background-color: var(--primary-text);
            mask-size: 15%;
            width: 4px;
            height: 20px;
            border: 10px solid transparent;
          }
          .icon_settings:hover {
            background-color: var(--secondary-text);
          }
          .address_name {
            color: var(--trophy-gold);
            font-size: 18px;
            font-weight: 600;
            overflow: auto;
            text-overflow: ellipsis;
          }
          .item-summary {
            overflow-wrap: break-word;
            word-break: break-all;
            display: flex;
            justify-content: flex-start;
            flex-direction: column;
            align-items: flex-start;
            margin: 0 auto;
            min-width: 0; // Allow collapsing if account name is too long.
            padding: 2px;
          }
          li {
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
            flex-direction: column;
            margin: 0 auto;
            width: 336px;
          }
          .account_container {
            margin-top: -10px;
            padding: 5px;
            border-radius: 16px;
          }
          .warning_message {
            font-size: 12px;
            line-height: 16px;
            font-weight: 500;
            color: var(--hunter-green);
          }
          .export_options {
            display: flex;
            flex-direction: column;
            width: 100%;
            gap: 10px;
            margin-top: 20px;
          }
          .export_option_button {
            width: 100%;
            background-color: var(--secondary-bg);
            border: none;
            cursor: pointer;
            padding: 10px;
            border-radius: 8px;
            transition: background-color 0.2s;
          }
          .export_option_button:hover {
            background-color: var(--green-80);
          }
          /* Ensure text color changes when hovering anywhere on the button */
          .export_option_button:hover :global(.option_label) {
            color: white !important;
          }
          .export_option_button:hover :global(.option_label .icon) {
            background-color: white !important;
          }
        `}
      </style>
    </div>
  )
}
