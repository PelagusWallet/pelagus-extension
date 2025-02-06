import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  selectCurrentAccount,
  selectCurrentAccountSigner,
  selectIsQiWalletInit,
  selectIsUtxoSelected,
  selectQiBalanceForCurrentUtxoAccountCyprus1,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { ReadOnlyAccountSigner } from "@pelagus/pelagus-background/services/signing"
import { useHistory } from "react-router-dom"
import { resetConvertAssetsSlice } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SharedButton from "../Shared/SharedButton"
import SharedSkeletonLoader from "../Shared/SharedSkeletonLoader"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import Receive from "../../pages/Receive"
import ReadOnlyNotice from "../Shared/ReadOnlyNotice"
import SharedCircleButton from "../Shared/SharedCircleButton"
import BalanceReloader from "../Balance/BalanceReloader"
import humanNumber from "human-number"
import { resetQiSendSlice } from "@pelagus/pelagus-background/redux-slices/qiSend"
import LockedBalanceCard from "../Balance/LockedBalanceCard"

type ActionButtonsProps = {
  onReceive: () => void
}

function ActionButtons(props: ActionButtonsProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet",
  })
  const { onReceive } = props
  const history = useHistory()

  const isUtxoSelected = useBackgroundSelector(selectIsUtxoSelected)
  const currentSelectedAccount = useBackgroundSelector(selectCurrentAccount)

  const isQiWalletInit = useBackgroundSelector(selectIsQiWalletInit)
  const dispatch = useBackgroundDispatch()

  return (
    <div className="action_buttons_container">
      <div className="action_buttons_wrap">
        <SharedCircleButton
          icon="icons/s/send.svg"
          ariaLabel={t("send")}
          onClick={async () => {
            if (
              currentSelectedAccount.network.chainID === "9" ||
              currentSelectedAccount.network.chainID === "9000"
            ) {
              return
            }

            if (!isUtxoSelected) {
              history.push("/send")
              return
            }

            await dispatch(resetQiSendSlice())
            history.push("/send-qi")
          }}
          size={55}
          iconWidth="12"
          iconHeight="18"
          disabled={
            currentSelectedAccount.network.chainID === "9" ||
            currentSelectedAccount.network.chainID === "9000"
          }
        >
          {t("send")}
        </SharedCircleButton>
        <SharedCircleButton
          icon="icons/s/receive.svg"
          ariaLabel={t("receive")}
          onClick={onReceive}
          size={55}
          iconWidth="12"
          iconHeight="18"
        >
          {t("receive")}
        </SharedCircleButton>

        <SharedCircleButton
          icon="icons/s/convert.svg"
          ariaLabel={t("swap")}
          onClick={async () => {
            if (
              currentSelectedAccount.network.chainID === "9" ||
              currentSelectedAccount.network.chainID === "9000"
            ) {
              return
            }

            await dispatch(resetConvertAssetsSlice())
            history.push("/convert")
          }}
          size={55}
          iconWidth="20"
          iconHeight="18"
          disabled={
            !isQiWalletInit ||
            currentSelectedAccount.network.chainID === "9" ||
            currentSelectedAccount.network.chainID === "9000"
          }
        >
          {t("swap")}
        </SharedCircleButton>
      </div>

      {currentSelectedAccount.network.chainID === "9" && (
        <div className="info_banner">
          <span className="info_text">
            Transactions available starting 02.19.2025.
          </span>
        </div>
      )}

      {currentSelectedAccount.network.chainID === "9000" && (
        <div className="info_banner">
          <span className="info_text">
            Testnet ended, so transactions are disabled.
          </span>
        </div>
      )}

      <style jsx>
        {`
          .action_buttons_container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 12px 0;
          }
          .action_buttons_wrap {
            display: flex;
            justify-content: center;
            gap: 24px;
            margin-bottom: 12px;
          }
          .info_banner {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 12px;
            background-color: var(--green-5);
            border-radius: 8px;
            margin-top: 8px;
            color: white;
          }
          .info_text {
            font-size: 14px;
            font-weight: 500;
            color: white;
          }
        `}
      </style>
    </div>
  )
}
interface Props {
  mainAssetBalance?: string
  mainAssetLockedBalance?: string
  initializationLoadingTimeExpired: boolean
}

export default function WalletAccountBalanceControl(
  props: Props
): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet",
  })
  const {
    mainAssetBalance,
    mainAssetLockedBalance,
    initializationLoadingTimeExpired,
  } = props
  const [openReceiveMenu, setOpenReceiveMenu] = useState(false)

  // TODO When non-imported accounts are supported, generalize this.
  const hasSavedSeed = true

  const currentAccountSigner = useBackgroundSelector(selectCurrentAccountSigner)

  const handleClick = useCallback(() => {
    setOpenReceiveMenu((currentlyOpen) => !currentlyOpen)
  }, [])

  const isUtxoSelected = useBackgroundSelector(selectIsUtxoSelected)

  const { spendableAmount: utxoBalance, lockedAmount: utxoLockedBalance } =
    useBackgroundSelector(selectQiBalanceForCurrentUtxoAccountCyprus1)

  const formatBalance = (balance: string) => {
    return Number(balance) < 1000
      ? balance
      : humanNumber(Number(balance), (n: number) => n.toFixed(3))
  }

  const [formattedBalance, setFormattedBalance] = useState("")
  const [formattedLockedBalance, setFormattedLockedBalance] = useState("")

  useEffect(() => {
    const balance = isUtxoSelected ? utxoBalance : mainAssetBalance
    const newFormattedBalance = formatBalance(balance || "0")
    setFormattedBalance(newFormattedBalance)
  }, [isUtxoSelected, utxoBalance, mainAssetBalance])

  useEffect(() => {
    const lockedBalance = isUtxoSelected
      ? utxoLockedBalance
      : mainAssetLockedBalance
    const newFormattedLockedBalance = formatBalance(lockedBalance || "0")
    setFormattedLockedBalance(newFormattedLockedBalance)
  }, [isUtxoSelected, utxoLockedBalance, mainAssetLockedBalance])

  const shouldIndicateLoadingHandle = ({
    isActionsSkeleton,
  }: {
    isActionsSkeleton: boolean
  }) => {
    if (!isUtxoSelected)
      return (
        !initializationLoadingTimeExpired &&
        typeof mainAssetBalance === "undefined"
      )

    return (
      !initializationLoadingTimeExpired && !utxoBalance && !isActionsSkeleton
    )
  }

  return (
    <>
      <SharedSlideUpMenu isOpen={openReceiveMenu} close={handleClick}>
        <Receive />
      </SharedSlideUpMenu>
      <div className="wrap">
        <SharedSkeletonLoader
          height={78}
          width={250}
          borderRadius={14}
          customStyles={isUtxoSelected ? "" : "margin: 12px 0"}
          isLoaded={!shouldIndicateLoadingHandle({ isActionsSkeleton: false })}
        >
          <div className="balance_label">{t("totalAccountBalance")}</div>
          <span className="balance_area">
            <span className="balance" data-testid="wallet_balance">
              <div className="balance_update_button">
                <BalanceReloader />
              </div>
              <span className="balance_text">{formattedBalance}</span>
              <div className="dollar_sign">
                {isUtxoSelected ? "QI" : "QUAI"}
              </div>
            </span>
          </span>
        </SharedSkeletonLoader>

        <SharedSkeletonLoader
          isLoaded={!shouldIndicateLoadingHandle({ isActionsSkeleton: true })}
          height={70}
          width={200}
          customStyles="margin-bottom: 10px;"
        >
          <ReadOnlyNotice />
          {currentAccountSigner !== ReadOnlyAccountSigner && (
            <>
              {hasSavedSeed ? (
                <ActionButtons onReceive={handleClick} />
              ) : (
                <div className="save_seed_button_wrap">
                  <SharedButton
                    iconSmall="arrow-right"
                    size="large"
                    type="warning"
                    linkTo="/onboarding/2"
                  >
                    {t("secureSeed")}
                  </SharedButton>
                </div>
              )}
            </>
          )}
          {}
        </SharedSkeletonLoader>

        <SharedSkeletonLoader
          height={25}
          width={200}
          borderRadius={14}
          isLoaded={!shouldIndicateLoadingHandle({ isActionsSkeleton: false })}
          customStyles="margin-top: 10px;"
        >
          {formattedLockedBalance && formattedLockedBalance != "0" && formattedLockedBalance != "0.00" && formattedLockedBalance != "0.000" && (
            <div className="locked_balance_card_wrap">
              <LockedBalanceCard
                balance={formattedLockedBalance}
                assetSymbol={isUtxoSelected ? "QI" : "QUAI"}
              />
            </div>
          )}
        </SharedSkeletonLoader>
      </div>
      <style jsx>
        {`
          .wrap {
            width: 100%;
            display: flex;
            flex-grow: 1;
            justify-contnet: space-between;
            align-items: center;
            flex-direction: column;
            box-sizing: border-box;
            padding-top: 6px;
          }
          .balance_area {
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .balance {
            color: var(--green-20);
            font-size: 36px;
            font-weight: 500;
            line-height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .balance_text {
            margin: 0 8px;
          }
          .dollar_sign {
            width: auto;
            height: 32px;
            color: var(--green-40);
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
            text-align: center;
          }
          .balance_update_button {
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background-color: #efefef;
            border-radius: 8px;
          }
          .save_seed_button_wrap {
            margin-top: 10px;
          }
          .balance_label {
            width: 195px;
            height: 24px;
            color: var(--green-40);
            font-size: 16px;
            font-weight: 400;
            line-height: 24px;
            text-align: center;
          }
          .locked_balance_card_wrap {
            margin-bottom: 12px;
          }
        `}
      </style>
    </>
  )
}
