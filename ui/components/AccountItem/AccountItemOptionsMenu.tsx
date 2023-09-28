import { AccountTotal } from "@pelagus/pelagus-background/redux-slices/selectors"
import { setSnackbarMessage } from "@pelagus/pelagus-background/redux-slices/ui"
import React, { ReactElement, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAreKeyringsUnlocked, useBackgroundDispatch } from "../../hooks"
import SharedDropdown from "../Shared/SharedDropDown"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import AccountItemEditName from "./AccountItemEditName"
import AccountItemRemovalConfirm from "./AccountItemRemovalConfirm"
import { useHistory } from "react-router-dom"
import { exportPrivKey } from "@pelagus/pelagus-background/redux-slices/keyrings"
import AccountitemOptionLabel from "./AccountItemOptionLabel"
import AccountHistoryRemovalConfirm from "./AccountHistoryRemovalConfirm"

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
  signerId
}: AccountItemOptionsMenuProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "accounts.accountItem",
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
  const [showClearTXHistory, setShowClearTXHistory] =
    useState(false)
  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(address)
    dispatch(setSnackbarMessage("Address copied to clipboard"))
  }, [address, dispatch])

  const copyKey = useCallback(() => {
    navigator.clipboard.writeText(key)
    dispatch(setSnackbarMessage("Key copied to clipboard"))
  }, [key, dispatch])

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
        customSize="130px"
        isOpen={showExportPrivateKey}
        close={(e) => {
          e?.stopPropagation()
          setKey("")
          setShowExportPrivateKey(false)
        }}
      >
        <li className="account_container">
        <div className="item-summary ">
        <div title="Private Key" className="address_name">Private Key</div>
        <text>{key}</text>
        </div>
        </li>
        <button
          type="button"
          onClick={() => copyKey()}
          style={{ marginLeft: "5%"}}
        >
          <AccountitemOptionLabel
                          icon={"icons/s/copy.svg"}
                          label={"Copy Key"}
                          hoverable
                          color={"var(--green-40)"}
                          hoverColor={"var(--green-20)"}
                        />
        </button>
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
            onClick: () => {
              if (areKeyringsUnlocked) {
                dispatch(exportPrivKey(address)).then(({key}) => {
                  setKey(key)
                  setShowExportPrivateKey(true)
                })
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
              if (signerId != null)
                moveAccountUp(address, signerId);
            }
          },
          {
            key: "moveDown",
            icon: "icons/s/arrow-down.svg",
            label: t("moveDown"),
            onClick: () => {
              if (signerId != null)
                moveAccountDown(address, signerId);
            }
          },
          {
            key: 'clearHistory',
            icon: 'garbage@2x.png',
            label: t('clearHistory'),
            onClick: () => {
              setShowClearTXHistory(true)
            },
            color: "var(--error)",
            hoverColor: "var(--error-80)",
          }
        ]}
      />

      <style jsx>
        {`
          .icon_settings {
            mask-image: url("./images/more_dots@2x.png");
            mask-repeat: no-repeat;
            mask-position: center;
            background-color: var(--green-60);
            mask-size: 20%;
            width: 4px;
            height: 20px;
            border: 10px solid transparent;
          }
          .icon_settings:hover {
            background-color: var(--green-40);
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
            overflow: auto;
            padding: 2px;
          }
          li {
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
            flex-direction: column;
            margin: 0 auto;
            width: 336px;
            height: 75px;
          }
          .account_container {
            margin-top: -10px;
            background-color: var(--hunter-green);
            padding: 5px;
            border-radius: 16px;
          }
        `}
      </style>
    </div>
  )
}
