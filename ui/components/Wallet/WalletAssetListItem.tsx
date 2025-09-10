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
            background-color: var(--primary-text);
          }
          .asset_icon:hover {
            background-color: var(--trophy-gold);
          }
          .asset_icon_send {
            mask-image: url("./images/send_asset.svg");
          }
          /* Ensure text turns white (contrast) over blue hover background in light mode */
          .asset_list_item:hover .asset_symbol,
          .asset_list_item:hover .asset_amount,
          .asset_list_item:hover .bold_amount_count {
            color: var(--contrast-text) !important;
          }
        `}
      </style>
    </li>
  )
}
