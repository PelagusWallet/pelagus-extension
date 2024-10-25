import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
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
import BalanceReloader from '../BalanceReloader/BalanceReloader';
import humanNumber from "human-number"

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

  const isQiWalletInit = useBackgroundSelector(selectIsQiWalletInit)
  const dispatch = useBackgroundDispatch()

  return (
    <div className="action_buttons_wrap">
      <SharedCircleButton
        icon="icons/s/send.svg"
        ariaLabel={t("send")}
        onClick={async () => {
          if (!isUtxoSelected) {
            history.push("/send")
            return
          }

          // await dispatch(resetQiSendSlice())
          // history.push("/send-qi")
        }}
        iconWidth="20"
        iconHeight="18"
        disabled={isUtxoSelected}
      >
        {t("send")}
      </SharedCircleButton>
      <SharedCircleButton
        icon="icons/s/receive.svg"
        ariaLabel={t("receive")}
        onClick={onReceive}
        iconWidth="20"
        iconHeight="18"
      >
        {t("receive")}
      </SharedCircleButton>

      <SharedCircleButton
        icon="icons/s/convert.svg"
        ariaLabel={t("swap")}
        onClick={async () => {
          await dispatch(resetConvertAssetsSlice())
          history.push("/convert")
        }}
        iconWidth="20"
        iconHeight="18"
        disabled={!isQiWalletInit}
      >
        {t("swap")}
      </SharedCircleButton>

      <style jsx>
        {`
          .action_buttons_wrap {
            display: flex;
            justify-content: center;
            //gap: 44px;
            gap: 24px;
            margin: 24px 0;
          }
          .centered_tooltip {
            display: flex;
            font-size: 14px;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
        `}
      </style>
    </div>
  )
}
interface Props {
  mainAssetBalance?: string
  initializationLoadingTimeExpired: boolean
}

export default function WalletAccountBalanceControl(
  props: Props
): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet",
  })
  const { mainAssetBalance, initializationLoadingTimeExpired } = props
  const [openReceiveMenu, setOpenReceiveMenu] = useState(false)

  // TODO When non-imported accounts are supported, generalize this.
  const hasSavedSeed = true

  const currentAccountSigner = useBackgroundSelector(selectCurrentAccountSigner)

  const handleClick = useCallback(() => {
    setOpenReceiveMenu((currentlyOpen) => !currentlyOpen)
  }, [])

  const isUtxoSelected = useBackgroundSelector(selectIsUtxoSelected)

  const utxoBalance = useBackgroundSelector(
    selectQiBalanceForCurrentUtxoAccountCyprus1
  )

  const formatBalance = (balance: string) => {
    let balanceSigFigs: number;
    if (!balance) return "0"
    let balanceValue: number;
    if (isUtxoSelected) {
      balanceValue = Number(balance) / 1e3
      balanceSigFigs = 3;
    } else {
      balanceValue = Number(balance) / 1e18
      balanceSigFigs = 4;
    }

    return balanceValue < 1000
      ? balanceValue.toFixed(0)
      : humanNumber(balanceValue, (n: number) => n.toFixed(balanceSigFigs))
  }

  const [formattedBalance, setFormattedBalance] = useState(
    formatBalance((isUtxoSelected ? utxoBalance : mainAssetBalance) || "0")
  )

  useEffect(() => {
    setFormattedBalance(formatBalance((isUtxoSelected ? utxoBalance : mainAssetBalance) || "0"))
  }, [isUtxoSelected, utxoBalance, mainAssetBalance])

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
          width={350}
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
              <span className="balance_text">
                {formattedBalance}
              </span>
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
            background-color: #EFEFEF;
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
        `}
      </style>
    </>
  )
}
