import React, { ReactElement } from "react"
import { CompleteAssetAmount } from "@pelagus/pelagus-background/redux-slices/accounts"

import {
  SmartContractFungibleAsset,
  SwappableAsset,
} from "@pelagus/pelagus-background/assets"

import CommonAssetListItem from "./AssetListItem/CommonAssetListItem"

type Props = {
  assetAmount: CompleteAssetAmount<SwappableAsset>
  initializationLoadingTimeExpired: boolean
  onUnverifiedAssetWarningClick?: (
    asset: CompleteAssetAmount<SmartContractFungibleAsset>["asset"]
  ) => void
}

export default function WalletAssetListItem(props: Props): ReactElement {
  const {
    assetAmount,
    initializationLoadingTimeExpired,
    onUnverifiedAssetWarningClick,
  } = props

  return (
    <li>
      <CommonAssetListItem
        assetAmount={assetAmount}
        initializationLoadingTimeExpired={initializationLoadingTimeExpired}
        onUnverifiedAssetWarningClick={onUnverifiedAssetWarningClick}
      />
      <style jsx global>
        {`
          .asset_icon {
            mask-size: cover;
            background-color: var(--green-60);
            width: 12px;
            height: 12px;
          }
          .asset_list_item:hover .asset_icon:not(:hover) {
            background-color: #ffffff;
          }
          .asset_icon:hover {
            background-color: var(--trophy-gold);
          }
          .asset_icon_gift {
            width: 22px;
            height: 22px;
            mask-image: url("./images/gift@2x.png");
          }
          .asset_icon_send {
            mask-image: url("./images/send_asset.svg");
          }
          .asset_icon_swap {
            mask-image: url("./images/swap_asset.svg");
          }
        `}
      </style>
    </li>
  )
}
