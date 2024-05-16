import React, { ReactElement } from "react"
import { Link } from "react-router-dom"
import { CompleteAssetAmount } from "@pelagus/pelagus-background/redux-slices/accounts"

import { useTranslation } from "react-i18next"
import {
  bigIntToDecimal,
  isUnverifiedAssetByUser,
} from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  isSmartContractFungibleAsset,
  SmartContractFungibleAsset,
  SwappableAsset,
} from "@pelagus/pelagus-background/assets"
import { FeatureFlags, isEnabled } from "@pelagus/pelagus-background/features"
import SharedAssetIcon from "../../Shared/SharedAssetIcon"
import styles from "./styles"
import SharedIconRouterLink from "../../Shared/SharedIconRouterLink"
import { useBackgroundSelector } from "../../../hooks"
import { trimWithEllipsis } from "../../../utils/textUtils"
import AssetVerifyToggler from "../UnverifiedAsset/AssetVerifyToggler"
import SharedIcon from "../../Shared/SharedIcon"

type CommonAssetListItemProps = {
  assetAmount: CompleteAssetAmount<SwappableAsset>
  initializationLoadingTimeExpired: boolean
  onUnverifiedAssetWarningClick?: (
    asset: CompleteAssetAmount<SmartContractFungibleAsset>["asset"]
  ) => void
}

const MAX_SYMBOL_LENGTH = 10

export default function CommonAssetListItem(
  props: CommonAssetListItemProps
): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet",
  })
  const {
    assetAmount,
    initializationLoadingTimeExpired,
    onUnverifiedAssetWarningClick,
  } = props
  const isMissingLocalizedUserValue =
    typeof assetAmount.localizedMainCurrencyAmount === "undefined"
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)

  const contractAddress =
    "contractAddress" in assetAmount.asset
      ? assetAmount.asset.contractAddress
      : undefined

  const isUnverified = isUnverifiedAssetByUser(assetAmount.asset)

  const handleVerifyAsset = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (
      isSmartContractFungibleAsset(assetAmount.asset) &&
      onUnverifiedAssetWarningClick
    ) {
      onUnverifiedAssetWarningClick(assetAmount.asset)
    }
  }

  return (
    <Link
      to={{
        pathname: "/singleAsset",
        state: assetAmount.asset,
      }}
    >
      <div className="asset_list_item">
        <div className="asset_left">
          <SharedAssetIcon
            logoURL={assetAmount?.asset?.metadata?.logoURL}
            symbol={assetAmount?.asset?.symbol}
          />
          <div className="asset_left_content">
            <div className="asset_amount">
              <span className="bold_amount_count">
                {bigIntToDecimal(
                  assetAmount.amount,
                  assetAmount.asset.decimals,
                  4
                )}
              </span>
              <span title={assetAmount.asset.symbol}>
                {trimWithEllipsis(assetAmount.asset.symbol, MAX_SYMBOL_LENGTH)}
              </span>
            </div>
          </div>
        </div>
        <div className="asset_right">
          <>
            {isEnabled(FeatureFlags.SUPPORT_UNVERIFIED_ASSET) &&
            isUnverified ? (
              <AssetVerifyToggler
                text={t("unverifiedAssets.verifyAsset")}
                icon="notif-attention"
                color="var(--attention)"
                hoverColor="var(--white)"
                onClick={(event) => handleVerifyAsset(event)}
              />
            ) : (
              <>
                {!isEnabled(FeatureFlags.SUPPORT_UNVERIFIED_ASSET) &&
                  isUnverified && (
                    <SharedIcon
                      icon="/icons/m/notif-attention.svg"
                      width={24}
                      color="var(--attention)"
                      onClick={(event) => handleVerifyAsset(event)}
                    />
                  )}
                <SharedIconRouterLink
                  path="/send"
                  state={assetAmount.asset}
                  iconClass="asset_icon_send"
                />
              </>
            )}
          </>
        </div>
      </div>
      <style jsx>{`
        ${styles}
        .price {
          height: 17px;
          display: flex;
          color: var(--green-40);
          font-size: 14px;
          font-weight: 400;
          letter-spacing: 0.42px;
          line-height: 16px;
        }
        .centered_tooltip {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
      `}</style>
    </Link>
  )
}
