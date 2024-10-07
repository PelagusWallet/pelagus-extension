import React, { ReactElement, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { selectCurrentAccountSigner } from "@pelagus/pelagus-background/redux-slices/selectors"
import { ReadOnlyAccountSigner } from "@pelagus/pelagus-background/services/signing"
import { useHistory } from "react-router-dom"
import { useBackgroundSelector } from "../../hooks"
import SharedButton from "../Shared/SharedButton"
import SharedSkeletonLoader from "../Shared/SharedSkeletonLoader"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import Receive from "../../pages/Receive"
import ReadOnlyNotice from "../Shared/ReadOnlyNotice"
import SharedCircleButton from "../Shared/SharedCircleButton"
import SharedTooltip from "../Shared/SharedTooltip"

type ActionButtonsProps = {
  onReceive: () => void
}

function ActionButtons(props: ActionButtonsProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet",
  })
  const { onReceive } = props
  const history = useHistory()

  return (
    <div className="action_buttons_wrap">
      <SharedCircleButton
        icon="icons/s/send.svg"
        ariaLabel={t("send")}
        onClick={() => history.push("/send")}
        iconWidth="20"
        iconHeight="18"
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

      <SharedTooltip
        type="dark"
        width={150}
        height={48}
        horizontalPosition="center"
        verticalPosition="bottom"
        horizontalShift={30}
        verticalShift={-35}
        customStyles={{
          marginLeft: "0",
          display: "flex",
          justifyContent: "center",
          width: "100%",
          margin: "0",
          padding: "0",
        }}
        IconComponent={() => (
          <SharedCircleButton
            icon="icons/s/convert.svg"
            ariaLabel={t("swap")}
            iconColor={{
              color: "#3A4565",
              hoverColor: "#3A4565",
            }}
            iconWidth="20"
            iconHeight="18"
            disabled
          >
            {t("swap")}
          </SharedCircleButton>
        )}
      >
        <div className="centered_tooltip">
          <div>{t("swapDisabledOne")}</div>
        </div>
      </SharedTooltip>

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

  const shouldIndicateLoading =
    !initializationLoadingTimeExpired && typeof mainAssetBalance === "undefined"

  return (
    <>
      <SharedSlideUpMenu isOpen={openReceiveMenu} close={handleClick}>
        <Receive />
      </SharedSlideUpMenu>
      <div className="wrap">
        <SharedSkeletonLoader
          height={48}
          width={250}
          borderRadius={14}
          customStyles="margin: 12px 0"
          isLoaded={!shouldIndicateLoading}
        >
          <div className="balance_label">{t("totalAccountBalance")}</div>
          <span className="balance_area">
            <span className="balance" data-testid="wallet_balance">
              {mainAssetBalance ?? 0}
              <span className="dollar_sign">Q</span>
            </span>
          </span>
        </SharedSkeletonLoader>

        <SharedSkeletonLoader
          isLoaded={!shouldIndicateLoading}
          height={24}
          width={180}
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
            display: flex;
            justify-contnet: space-between;
            align-items: center;
            flex-direction: column;
            box-sizing: border-box;
            padding-top: 6px;
          }
          .balance_area {
            height: 48px;
          }
          .balance {
            color: var(--green-20);
            font-size: 36px;
            font-weight: 500;
            line-height: 48px;
            display: flex;
            align-items: center;
          }
          .balance_actions {
            margin-bottom: 20px;
          }
          .balance_label {
            width: 165px;
            height: 24px;
            color: var(--green-40);
            font-size: 16px;
            font-weight: 400;
            line-height: 24px;
            text-align: center;
          }
          .dollar_sign {
            width: 14px;
            height: 32px;
            color: var(--green-40);
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
            text-align: center;
            margin-left: 4px;
          }
          .save_seed_button_wrap {
            margin-top: 10px;
          }
        `}
      </style>
    </>
  )
}
