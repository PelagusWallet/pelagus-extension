import React, { ReactElement, useEffect, useMemo, useState } from "react"
import {
  selectCurrentAccountActivities,
  selectCurrentAccountBalances,
  selectCurrentNetwork,
} from "@pelagus/pelagus-background/redux-slices/selectors"

import classNames from "classnames"
import { useTranslation } from "react-i18next"
import {
  selectShowAlphaWalletBanner,
  selectShowUnverifiedAssets,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { CompleteAssetAmount } from "@pelagus/pelagus-background/redux-slices/accounts"
import {
  SwappableAsset,
  isFungibleAsset,
} from "@pelagus/pelagus-background/assets"
import { useHistory } from "react-router-dom"
import { bigIntToDecimal } from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import { useBackgroundSelector } from "../hooks"
import SharedPanelSwitcher from "../components/Shared/SharedPanelSwitcher"
import WalletAssetList from "../components/Wallet/WalletAssetList"
import WalletActivityList from "../components/Wallet/WalletActivityList"
import WalletAccountBalanceControl from "../components/Wallet/WalletAccountBalanceControl"
import WalletNoConnectionBanner from "../components/Wallet/WalletNoConnectionBanner"
import WalletHiddenAssets from "../components/Wallet/WalletHiddenAssets"
import WalletAlphaBanner from "../components/Wallet/WalletAlphaBanner"
import SharedButton from "../components/Shared/SharedButton"
import SharedIcon from "../components/Shared/SharedIcon"

export default function Wallet(): ReactElement {
  const { t } = useTranslation()
  const [panelNumber, setPanelNumber] = useState(0)

  const history = useHistory()

  const accountData = useBackgroundSelector(selectCurrentAccountBalances)
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)
  const showUnverifiedAssets = useBackgroundSelector(selectShowUnverifiedAssets)

  const { assetAmounts, unverifiedAssetAmounts } = accountData ?? {
    assetAmounts: [],
    unverifiedAssetAmounts: [],
    totalMainCurrencyValue: undefined,
  }

  const currentAccountActivities = useBackgroundSelector(
    selectCurrentAccountActivities
  )

  useEffect(() => {
    const locationState = history.location.state
    if (locationState) {
      const { goTo } = locationState as { goTo?: string }
      if (goTo === "activity-page") {
        setPanelNumber(1)
      }
    }
  }, [history, selectedNetwork.chainID])

  const initializationLoadingTimeExpired = useBackgroundSelector(
    (background) => background.ui?.initializationLoadingTimeExpired
  )

  // TODO-MIGRATION
  // const showAnalyticsNotification = useBackgroundSelector(
  //   selectShowAnalyticsNotification
  // )
  const showAlphaWalletBanner = useBackgroundSelector(
    selectShowAlphaWalletBanner
  )

  const showHiddenAssets = useMemo(
    () => showUnverifiedAssets && unverifiedAssetAmounts.length > 0,
    [showUnverifiedAssets, unverifiedAssetAmounts.length]
  )

  const panelNames = [t("wallet.pages.assets")]

  panelNames.push(t("wallet.pages.activity"))

  const mainAssetBalance = useMemo(() => {
    if (!assetAmounts[0] || !isFungibleAsset(assetAmounts[0].asset)) return "0"

    return bigIntToDecimal(
      assetAmounts[0].amount,
      assetAmounts[0].asset.decimals,
      4
    )
  }, [assetAmounts])

  return (
    <>
      <div className="page_content">
        {showAlphaWalletBanner && <WalletAlphaBanner />}
        {/* {!showAnalyticsNotification && */}
        {/*  isDisabled(FeatureFlags.ENABLE_UPDATED_DAPP_CONNECTIONS) && ( */}
        {/*    <WalletToggleDefaultBanner /> */}
        {/*  )} */}

        <WalletNoConnectionBanner />

        <div className="section">
          <WalletAccountBalanceControl
            mainAssetBalance={mainAssetBalance}
            initializationLoadingTimeExpired={initializationLoadingTimeExpired}
          />
        </div>
        <div className="section">
          <SharedPanelSwitcher
            setPanelNumber={setPanelNumber}
            panelNumber={panelNumber}
            panelNames={panelNames}
          />
          <div className={classNames("panel standard_width")}>
            {panelNumber === 0 && (
              <>
                <WalletAssetList
                  assetAmounts={
                    // FIXME: Refactor AnyAsset type
                    assetAmounts as CompleteAssetAmount<SwappableAsset>[]
                  }
                  initializationLoadingTimeExpired={
                    initializationLoadingTimeExpired
                  }
                />
                <div
                  className={classNames("add_custom_asset", {
                    line: showHiddenAssets,
                  })}
                >
                  <span>{t("wallet.activities.addCustomAssetPrompt")}</span>
                  <SharedButton
                    size="medium"
                    onClick={() => history.push("/settings/add-custom-asset")}
                    type="tertiary"
                  >
                    <SharedIcon
                      width={16}
                      height={16}
                      customStyles="margin-right: 4px"
                      icon="icons/s/add.svg"
                      color="currentColor"
                    />
                    {t("wallet.activities.addCustomAssetAction")}
                  </SharedButton>
                </div>
                {showHiddenAssets && (
                  <WalletHiddenAssets
                    assetAmounts={
                      // FIXME: Refactor AnyAsset type
                      unverifiedAssetAmounts as CompleteAssetAmount<SwappableAsset>[]
                    }
                  />
                )}
              </>
            )}
            {panelNumber === 1 && (
              <WalletActivityList activities={currentAccountActivities ?? []} />
            )}
          </div>
        </div>
      </div>
      <style jsx>
        {`
          .page_content {
            width: 100%;
            height: inherit;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }

          .section {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
          }

          .panel {
            padding-top: 16px;
            box-sizing: border-box;
            height: 302px;
          }

          .panel::-webkit-scrollbar {
            display: none;
          }

          .add_custom_asset {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16px 0;
            margin: 0 16px;
          }

          .add_custom_asset span {
            font-size: 16px;
            font-weight: 500;
            line-height: 24px;
            letter-spacing: 0;
            text-align: left;
            color: var(--green-40);
          }

          .line {
            border-bottom: 1px solid var(--green-80);
            margin-bottom: 8px;
          }
        `}
      </style>
    </>
  )
}
