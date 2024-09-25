import React, { ReactElement, useState } from "react"
import { useLocation } from "react-router-dom"
import {
  selectCurrentAccount,
  selectCurrentAccountActivities,
  selectCurrentAccountBalances,
  selectCurrentAccountSigner,
  selectCurrentNetwork,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { sameQuaiAddress } from "@pelagus/pelagus-background/lib/utils"
import {
  AnyAsset,
  isSmartContractFungibleAsset,
  SmartContractFungibleAsset,
} from "@pelagus/pelagus-background/assets"
import { ReadOnlyAccountSigner } from "@pelagus/pelagus-background/services/signing"
import { useTranslation } from "react-i18next"
import { CurrentShardToExplorer } from "@pelagus/pelagus-background/constants"
import {
  isUntrustedAsset,
  isUnverifiedAssetByUser,
} from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import { FeatureFlags, isEnabled } from "@pelagus/pelagus-background/features"
import { NetworksArray } from "@pelagus/pelagus-background/constants/networks/networks"
import { isQuaiHandle } from "@pelagus/pelagus-background/constants/networks/networkUtils"
import { useBackgroundSelector } from "../hooks"
import SharedAssetIcon from "../components/Shared/SharedAssetIcon"
import SharedButton from "../components/Shared/SharedButton"
import WalletActivityList from "../components/Wallet/WalletActivityList"
import SharedBackButton from "../components/Shared/SharedBackButton"
import SharedTooltip from "../components/Shared/SharedTooltip"
import { blockExplorer } from "../utils/constants"
import AssetVerifyToggler from "../components/Wallet/UnverifiedAsset/AssetVerifyToggler"
import { trimWithEllipsis } from "../utils/textUtils"
import AssetWarningWrapper from "../components/Wallet/UnverifiedAsset/AssetWarningWrapper"

const MAX_SYMBOL_LENGTH = 10

export default function SingleAsset(): ReactElement {
  const { t } = useTranslation()
  const location = useLocation<AnyAsset>()
  const currentAccount = useBackgroundSelector(selectCurrentAccount)
  const locationAsset = location.state ?? currentAccount.network.baseAsset

  const { symbol } = locationAsset
  const contractAddress =
    "contractAddress" in locationAsset
      ? locationAsset.contractAddress
      : undefined

  const currentAccountSigner = useBackgroundSelector(selectCurrentAccountSigner)
  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const account = useBackgroundSelector(selectCurrentAccount)

  const filteredActivities = useBackgroundSelector((state) =>
    (selectCurrentAccountActivities(state) ?? []).filter((activity) => {
      if (
        typeof contractAddress !== "undefined" &&
        contractAddress === activity.to
      ) {
        return true
      }
      switch (activity?.type) {
        case "asset-transfer":
        case "external-transfer":
        case "asset-approval":
          return activity.assetSymbol === symbol
        case "contract-interaction":
        case "contract-deployment":
        default:
          return false
      }
    })
  )

  const { asset, localizedDecimalAmount } = useBackgroundSelector((state) => {
    const balances = selectCurrentAccountBalances(state)

    if (typeof balances === "undefined") {
      return undefined
    }

    return balances.allAssetAmounts.find(({ asset: candidateAsset }) => {
      if (typeof contractAddress !== "undefined") {
        return (
          isSmartContractFungibleAsset(candidateAsset) &&
          sameQuaiAddress(candidateAsset.contractAddress, contractAddress)
        )
      }
      return candidateAsset.symbol === symbol
    })
  }) ?? {
    asset: undefined,
    localizedMainCurrencyAmount: undefined,
    localizedDecimalAmount: undefined,
  }

  const isUntrusted = isUntrustedAsset(asset)
  const isUnverifiedByUser = isUnverifiedAssetByUser(asset)
  const [warnedAsset, setWarnedAsset] =
    useState<SmartContractFungibleAsset | null>(null)

  const showActionButtons = isEnabled(FeatureFlags.SUPPORT_UNVERIFIED_ASSET)
    ? !isUnverifiedByUser
    : true

  return (
    <>
      <AssetWarningWrapper
        asset={warnedAsset}
        close={() => {
          setWarnedAsset(null)
        }}
      />
      <div className="navigation standard_width_padded">
        <SharedBackButton path="/" />
        {isEnabled(FeatureFlags.SUPPORT_UNVERIFIED_ASSET) && (
          <>
            {isUntrusted &&
              !isUnverifiedByUser &&
              asset &&
              isSmartContractFungibleAsset(asset) && (
                <AssetVerifyToggler
                  text={t("assets.verifiedByUser")}
                  icon="notif-correct"
                  color="var(--green-20)"
                  hoverColor="var(--white)"
                  onClick={() => setWarnedAsset(asset)}
                />
              )}
          </>
        )}
      </div>
      {asset && (
        <div className="header standard_width_padded">
          <div className="left">
            <div className="asset_wrap">
              <SharedAssetIcon
                logoURL={asset?.metadata?.logoURL}
                symbol={asset?.symbol}
              />
              <span className="asset_name">
                {trimWithEllipsis(symbol, MAX_SYMBOL_LENGTH)}
              </span>
              {contractAddress && (
                <SharedTooltip
                  width={155}
                  IconComponent={() => (
                    <a
                      className="new_tab_link"
                      href={
                        NetworksArray.find(
                          (network) =>
                            network.chainID === currentNetwork.chainID
                        )
                          ? `${
                              isQuaiHandle(currentNetwork)
                                ? CurrentShardToExplorer(
                                    currentNetwork,
                                    account.address
                                  )
                                : blockExplorer[currentNetwork.chainID].url
                            }/token/${contractAddress}`
                          : currentNetwork.blockExplorerURL
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="icon_new_tab" />
                    </a>
                  )}
                >
                  {blockExplorer[currentNetwork.chainID]
                    ? t("assets.viewAsset", {
                        siteTitle: blockExplorer[currentNetwork.chainID].title,
                      })
                    : t("assets.openNetworkExplorer")}
                </SharedTooltip>
              )}
            </div>
            <div className="balance">{localizedDecimalAmount}</div>
          </div>
          <div className="right">
            {isEnabled(FeatureFlags.SUPPORT_UNVERIFIED_ASSET) && (
              <>
                {isUnverifiedByUser && isSmartContractFungibleAsset(asset) && (
                  <div className="unverified_asset_button">
                    <AssetVerifyToggler
                      text={t("assets.unverifiedAsset")}
                      icon="notif-attention"
                      color="var(--green-20)"
                      hoverColor="var(--white)"
                      onClick={() => setWarnedAsset(asset)}
                    />
                    <div>
                      <SharedButton
                        type="primary"
                        size="medium"
                        onClick={() => setWarnedAsset(asset)}
                      >
                        {t("assets.verifyAsset")}
                      </SharedButton>
                    </div>
                  </div>
                )}
              </>
            )}

            {showActionButtons &&
              currentAccountSigner !== ReadOnlyAccountSigner && (
                <>
                  <SharedButton
                    type="primary"
                    size="medium"
                    iconSmall="send"
                    linkTo={{
                      pathname: "/send",
                      state: asset,
                    }}
                  >
                    {t("shared.send")}
                  </SharedButton>
                </>
              )}
          </div>
        </div>
      )}
      <WalletActivityList activities={filteredActivities} />
      <style jsx>
        {`
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 24px;
            gap: 4px;
          }
          .header .right {
            height: 95px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .unverified_asset_button {
            display: flex;
            flex-direction: column;
            align-items: end;
            justify-content: end;
            box-sizing: border-box;
            padding-top: 12px;
            gap: 16px;
          }
          .asset_name {
            color: var(--green-20);
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
            text-transform: uppercase;
            margin-left: 8px;
            word-break: break-word;
          }
          .asset_wrap {
            display: flex;
            align-items: center;
          }
          .balance {
            width: 100%;
            max-width: 177px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--green-20);
            font-size: 36px;
            font-weight: 500;
            line-height: 48px;
          }
          .icon_new_tab {
            mask-image: url("./images/new_tab@2x.png");
            mask-size: cover;
            width: 16px;
            height: 16px;
            background-color: var(--green-40);
            margin: 0 5px;
          }
          .new_tab_link:hover .icon_new_tab {
            background-color: var(--trophy-gold);
          }
          .navigation {
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
          }
        `}
      </style>
    </>
  )
}
