import React, { ReactElement, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { useHistory } from "react-router-dom"
import { exportQiCoinbaseAddress } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import { useAreKeyringsUnlocked, useBackgroundDispatch } from "../../hooks"
import SharedDropdown from "../Shared/SharedDropDown"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import AccountitemOptionLabel from "./AccountItemOptionLabel"
import SharedBanner from "../Shared/SharedBanner"
import { addToOffscreenClipboardSensitiveData } from "../../../src/offscreen"
import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import { QiCoinbaseAddress } from "@pelagus/pelagus-background/accounts"

type QiCoinbaseAddressOptionsMenuProps = {
  qiCoinbaseAddress: QiCoinbaseAddress
}

export default function QiCoinbaseAddressOptionsMenu({
  qiCoinbaseAddress,
}: QiCoinbaseAddressOptionsMenuProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "accounts.accountItem",
  })
  const { t: tAccounts } = useTranslation("translation", {
    keyPrefix: "accounts",
  })
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const [key, setKey] = useState("")
  const [showExportPrivateKey, setShowExportPrivateKey] = useState(false)

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(qiCoinbaseAddress.address)
    dispatch(setSnackbarConfig({ message: "Address copied to clipboard" }))
  }, [qiCoinbaseAddress.address, dispatch])

  const copyPrivateKey = async () => {
    await addToOffscreenClipboardSensitiveData(key)
    dispatch(setSnackbarConfig({ message: "Key copied to clipboard" }))
  }

  const onClosePrivateKeyModal = () => {
    setKey("")
    setShowExportPrivateKey(false)
  }

  return (
    <div className="options_menu_wrap">
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
              color="var(--green-40)"
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
                const { key: keyFromRedux } = (await dispatch(
                  exportQiCoinbaseAddress(qiCoinbaseAddress.address)
                )) as AsyncThunkFulfillmentType<typeof exportQiCoinbaseAddress>
                setKey(keyFromRedux)
                setShowExportPrivateKey(true)
              } else {
                history.push("/keyring/unlock")
              }
            },
          },
        ]}
      />

      <style jsx>
        {`
          .icon_settings {
            mask-image: url("./images/more_dots@2x.png");
            mask-repeat: no-repeat;
            mask-position: center;
            background-color: var(--white);
            mask-size: 15%;
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
            min-width: 0;
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
          }
          .account_container {
            margin-top: -10px;
            background-color: var(--hunter-green);
            padding: 5px;
            border-radius: 16px;
          }
          .warning_message {
            font-size: 12px;
            line-height: 16px;
            font-weight: 500;
            color: var(--hunter-green);
          }
        `}
      </style>
    </div>
  )
}
