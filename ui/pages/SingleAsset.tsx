import React, { ReactElement, useState } from "react"
import { useLocation, useHistory } from "react-router-dom"
import {
  selectCurrentAccount,
  selectCurrentAccountActivities,
  selectCurrentAccountBalances,
  selectCurrentAccountSigner,
  selectCurrentAccountTotal,
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
import { PELAGUS_NETWORKS } from "@pelagus/pelagus-background/constants/networks/networks"
import { isQuaiHandle } from "@pelagus/pelagus-background/constants/networks/networkUtils"
import { WRAPPED_QI_CONTRACT_ADDRESS, WRAPPED_QUAI_CONTRACT_ADDRESS } from "@pelagus/pelagus-background/constants/base-assets"
import { useBackgroundSelector, useBackgroundDispatch } from "../hooks"
import { setConvertFrom, setConvertAmount } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import SharedButton from "../components/Shared/SharedButton"
import WalletActivityList from "../components/Wallet/WalletActivityList"
import SharedBackButton from "../components/Shared/SharedBackButton"
import SharedTooltip from "../components/Shared/SharedTooltip"
import { blockExplorer } from "../utils/constants"
import AssetVerifyToggler from "../components/Wallet/UnverifiedAsset/AssetVerifyToggler"
import { trimWithEllipsis } from "../utils/textUtils"
import AssetWarningWrapper from "../components/Wallet/UnverifiedAsset/AssetWarningWrapper"
import { isAccountTotalTypeGuard } from "../utils/accounts"

const MAX_SYMBOL_LENGTH = 10

export default function SingleAsset(): ReactElement {
  const { t } = useTranslation()
  const location = useLocation<AnyAsset>()
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
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
  const currentAccountTotal = useBackgroundSelector(selectCurrentAccountTotal)

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
  
  // Check if this is WQI/WQUAI and if the balance is greater than 0
  const isWQI = contractAddress && sameQuaiAddress(contractAddress, WRAPPED_QI_CONTRACT_ADDRESS)
  const hasWQIBalance = isWQI && localizedDecimalAmount && parseFloat(localizedDecimalAmount) > 0
  const isWQUAI = contractAddress && sameQuaiAddress(contractAddress, WRAPPED_QUAI_CONTRACT_ADDRESS)
  const hasWQUAIBalance = isWQUAI && localizedDecimalAmount && parseFloat(localizedDecimalAmount) > 0
  
  const handleUnwrap = () => {
    if (!currentAccountTotal || !localizedDecimalAmount || !asset) return
    
    // Set the from account (current Quai account with WQI)
    // currentAccountTotal is already an AccountTotal type
    // Format the balance to include WQI symbol
    const fromAccount = {
      ...currentAccountTotal,
      balance: `${localizedDecimalAmount} WQI`
    }
    
    dispatch(setConvertFrom(fromAccount))
    
    // Navigate to unwrap page
    history.push("/unwrap")
  }

  const handleUnwrapWQuai = () => {
    if (!currentAccountTotal || !localizedDecimalAmount || !asset) return
    const fromAccount = {
      ...currentAccountTotal,
      balance: `${localizedDecimalAmount} WQUAI`
    }
    dispatch(setConvertFrom(fromAccount))
    history.push("/unwrap-wquai")
  }

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
            <div className="balance">{localizedDecimalAmount}</div>

            <div className="asset_wrap">
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
                        PELAGUS_NETWORKS.find(
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
                <div className="action-buttons">
                  <SharedButton
                    type="primary"
                    size="medium"
                    iconSmall="send"
                    linkTo={{
                      pathname: "/send",
                      state: asset,
                    }}
                    style={{ color: "var(--contrast-text)" }}
                  >
                    {t("shared.send")}
                  </SharedButton>
                  {(hasWQIBalance || hasWQUAIBalance) && (
                    <SharedButton
                      type="secondary"
                      size="medium"
                      onClick={hasWQIBalance ? handleUnwrap : handleUnwrapWQuai}
                    >
                      Unwrap
                    </SharedButton>
                  )}
                </div>
              )}
          </div>
        </div>
      )}
      <WalletActivityList activities={filteredActivities} />
      <style jsx>
        {`
          .header {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            padding-bottom: 24px;
            gap: 16px;
          }
          .header .left {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }
          .header .right {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            width: 100%;
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
            color: var(--primary-text);
            font-size: 28px;
            font-weight: 500;
            line-height: 40px;
            text-transform: uppercase;
          }
          .asset_wrap {
            display: flex;
            align-items: center;
            flex: 0 0 auto;
          }
          .balance {
            flex: 0 1 auto;
            min-width: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--primary-text);
            font-size: 28px;
            font-weight: 500;
            line-height: 40px;
          }
          .icon_new_tab {
            mask-image: url("./images/new_tab@2x.png");
            mask-size: cover;
            width: 16px;
            height: 16px;
            background-color: var(--secondary-text);
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
          .action-buttons {
            display: flex;
            gap: 8px;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            width: 100%;
          }
        `}
      </style>
    </>
  )
}
