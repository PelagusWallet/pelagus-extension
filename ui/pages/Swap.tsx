import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  approveTransfer,
  fetchSwapQuote,
  executeSwap,
} from "@pelagus/pelagus-background/redux-slices/0x-swap"
import { FeatureFlags, isEnabled } from "@pelagus/pelagus-background/features"
import {
  selectCurrentAccountBalances,
  selectCurrentAccountSigner,
  selectCurrentNetwork,
  selectMainCurrencySign,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  isSmartContractFungibleAsset,
  SwappableAsset,
} from "@pelagus/pelagus-background/assets"
import logger from "@pelagus/pelagus-background/lib/logger"
import { Redirect, useLocation } from "react-router-dom"
import { normalizeEVMAddress } from "@pelagus/pelagus-background/lib/utils"
import { selectDefaultNetworkFeeSettings } from "@pelagus/pelagus-background/redux-slices/selectors/transactionConstructionSelectors"
import { selectSlippageTolerance } from "@pelagus/pelagus-background/redux-slices/ui"
import { ReadOnlyAccountSigner } from "@pelagus/pelagus-background/services/signing"
import {
  NETWORKS_SUPPORTING_SWAPS,
  SECOND,
} from "@pelagus/pelagus-background/constants"

import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import {
  selectLatestQuoteRequest,
  selectSwapBuyAssets,
  selectInProgressApprovalContract,
} from "@pelagus/pelagus-background/redux-slices/selectors/0xSwapSelectors"
import { isSameAsset } from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import SharedAssetInput from "../components/Shared/SharedAssetInput"
import SharedButton from "../components/Shared/SharedButton"
import SharedActivityHeader from "../components/Shared/SharedActivityHeader"
import { useBackgroundDispatch, useBackgroundSelector } from "../hooks"
import SharedIcon from "../components/Shared/SharedIcon"
import SharedBanner from "../components/Shared/SharedBanner"
import ReadOnlyNotice from "../components/Shared/ReadOnlyNotice"
import ApproveQuoteBtn from "../components/Swap/ApproveQuoteButton"
import {
  useSwapQuote,
  getSellAssetAmounts,
  getOwnedSellAssetAmounts,
} from "../utils/swap"
import { useOnMount, usePrevious, useInterval } from "../hooks/react-hooks"
import SharedBackButton from "../components/Shared/SharedBackButton"

const REFRESH_QUOTE_INTERVAL = 10 * SECOND

export default function Swap(): ReactElement {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()
  const location = useLocation<
    { symbol: string; contractAddress?: string } | undefined
  >()

  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const accountBalances = useBackgroundSelector(selectCurrentAccountBalances)
  const mainCurrencySign = useBackgroundSelector(selectMainCurrencySign)

  const currentAccountSigner = useBackgroundSelector(selectCurrentAccountSigner)
  const isReadOnlyAccount = currentAccountSigner === ReadOnlyAccountSigner

  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const ownedSellAssetAmounts = getOwnedSellAssetAmounts(
    accountBalances?.allAssetAmounts,
    currentNetwork
  )

  const {
    symbol: locationAssetSymbol,
    contractAddress: locationAssetContractAddress,
  } = location.state ?? {}
  const locationAsset = ownedSellAssetAmounts.find(
    ({ asset: candidateAsset }) => {
      if (typeof locationAssetContractAddress !== "undefined") {
        return (
          isSmartContractFungibleAsset(candidateAsset) &&
          normalizeEVMAddress(candidateAsset.contractAddress) ===
            normalizeEVMAddress(locationAssetContractAddress)
        )
      }
      return candidateAsset.symbol === locationAssetSymbol
    }
  )?.asset

  const savedQuoteRequest = useBackgroundSelector(selectLatestQuoteRequest)

  const {
    assets: { sellAsset: savedSellAsset, buyAsset: savedBuyAsset },
    amount: savedSwapAmount,
  } = (!locationAsset && savedQuoteRequest) || {
    // ^ If coming from an asset item swap button, let the UI start fresh
    assets: { sellAsset: locationAsset },
  }

  const [sellAsset, setSellAsset] = useState<SwappableAsset | undefined>(
    savedSellAsset
  )
  const [buyAsset, setBuyAsset] = useState<SwappableAsset | undefined>(
    savedBuyAsset
  )
  const [sellAmount, setSellAmount] = useState(
    typeof savedSwapAmount !== "undefined" && "sellAmount" in savedSwapAmount
      ? savedSwapAmount.sellAmount
      : ""
  )
  const [buyAmount, setBuyAmount] = useState(
    typeof savedSwapAmount !== "undefined" && "buyAmount" in savedSwapAmount
      ? savedSwapAmount.buyAmount
      : ""
  )

  const previousChainId = usePrevious(currentNetwork.chainID)

  useEffect(() => {
    if (previousChainId !== currentNetwork.chainID) {
      setSellAsset(undefined)
      setBuyAsset(undefined)
      setSellAmount("")
      setBuyAmount("")
    }
  }, [previousChainId, currentNetwork.chainID])

  const buyAssets = useBackgroundSelector((state) => {
    const assets = selectSwapBuyAssets(state)
    return assets.filter((asset) => asset.symbol !== sellAsset?.symbol)
  })

  const sellAssetAmounts = getSellAssetAmounts(
    ownedSellAssetAmounts,
    sellAsset,
    buyAsset
  )

  useEffect(() => {
    if (typeof sellAsset !== "undefined") {
      const isSelectedSellAssetInSellAssets = sellAssetAmounts.some(
        ({ asset }) => isSameAsset(asset, sellAsset)
      )

      if (!isSelectedSellAssetInSellAssets) {
        sellAssetAmounts.push({
          asset: sellAsset,
          amount: 0n,
          decimalAmount: 0,
          localizedDecimalAmount: "0",
        })
      }
    }
  }, [sellAsset, sellAssetAmounts])

  const {
    loading: loadingQuote,
    loadingSellAmount,
    loadingBuyAmount,
    quote,
    requestQuoteUpdate,
  } = useSwapQuote({
    initialSwapSettings: {
      slippageTolerance: useBackgroundSelector(selectSlippageTolerance),
      networkSettings: useBackgroundSelector(selectDefaultNetworkFeeSettings),
    },
  })

  const inProgressApprovalContract = useBackgroundSelector(
    selectInProgressApprovalContract
  )
  const isApprovalInProgress =
    sellAsset &&
    "contractAddress" in sellAsset &&
    normalizeEVMAddress(inProgressApprovalContract || "0x") ===
      normalizeEVMAddress(sellAsset?.contractAddress || "0x")

  const approveAsset = useCallback(async () => {
    if (!quote) return

    if (typeof sellAsset === "undefined") {
      logger.error(t("swap.error.noSellAsset"))
      return
    }
    if (typeof quote.approvalTarget === "undefined") {
      logger.error(t("swap.error.noApprovalTarget"))
      return
    }
    if (!isSmartContractFungibleAsset(sellAsset)) {
      logger.error(t("swap.error.nonContractAsset"), sellAsset)
      return
    }

    await dispatch(
      approveTransfer({
        assetContractAddress: sellAsset.contractAddress,
        approvalTarget: quote.approvalTarget,
      })
    )
  }, [dispatch, quote, sellAsset, t])

  const updateSellAsset = useCallback(
    (newSellAsset: SwappableAsset) => {
      setSellAsset(newSellAsset)
      setSellAmount("")

      // Updating the source asset quotes the new source asset against the existing
      // target amount.
      if (newSellAsset && buyAsset && buyAmount) {
        requestQuoteUpdate({
          type: "getSellAmount",
          amount: buyAmount,
          sellAsset: newSellAsset,
          buyAsset,
        })
        requestQuoteUpdate.flush()
      }
    },
    [requestQuoteUpdate, buyAmount, buyAsset]
  )

  const updateBuyAsset = useCallback(
    (newBuyAsset: SwappableAsset) => {
      setBuyAsset(newBuyAsset)
      setBuyAmount("")

      // Updating the target asset quotes the new target asset against the existing
      // source amount.
      if (sellAsset && newBuyAsset && sellAmount) {
        requestQuoteUpdate({
          type: "getBuyAmount",
          amount: sellAmount,
          sellAsset,
          buyAsset: newBuyAsset,
        })
        requestQuoteUpdate.flush()
      }
    },
    [sellAmount, requestQuoteUpdate, sellAsset]
  )

  const flipSwap = useCallback(() => {
    const [newSellAsset, newBuyAsset] = [buyAsset, sellAsset]
    const [newSellAmount, newBuyAmount] = [buyAmount, sellAmount]

    setSellAsset(newSellAsset)
    setBuyAsset(newBuyAsset)

    if (newSellAmount) {
      setSellAmount(newSellAmount)
    }

    if (newBuyAmount) {
      setBuyAmount(newBuyAmount)
    }

    if (newSellAmount && newSellAsset && newBuyAsset)
      requestQuoteUpdate({
        type: "getBuyAmount",
        amount: buyAmount,
        sellAsset: newSellAsset,
        buyAsset: newBuyAsset,
      })
  }, [buyAmount, sellAmount, buyAsset, sellAsset, requestQuoteUpdate])

  const quoteAppliesToCurrentAssets =
    quote &&
    sellAsset &&
    buyAsset &&
    isSameAsset(quote.sellAsset, sellAsset) &&
    isSameAsset(quote.buyAsset, buyAsset)

  // Update if quote changes

  const prevQuoteTimestamp = usePrevious(quote?.timestamp)

  if (
    quote &&
    !loadingQuote &&
    quote.timestamp !== prevQuoteTimestamp &&
    quoteAppliesToCurrentAssets &&
    quote.quote
  ) {
    const { quote: newAmount, type } = quote

    if (type === "getSellAmount" && newAmount !== sellAmount) {
      setSellAmount(newAmount)
    } else if (type === "getBuyAmount" && newAmount !== buyAmount) {
      setBuyAmount(newAmount)
    }
  }

  const [amountInputHasFocus, setAmountInputHasFocus] = useState(false)

  useInterval(() => {
    if (!isEnabled(FeatureFlags.SUPPORT_SWAP_QUOTE_REFRESH)) return

    const isRecentQuote =
      quote &&
      // Time passed since last quote
      Date.now() - quote.timestamp <= 3 * SECOND

    const skipRefresh =
      loadingQuote || (isRecentQuote && quoteAppliesToCurrentAssets)

    if (
      !skipRefresh &&
      !amountInputHasFocus &&
      sellAsset &&
      buyAsset &&
      (sellAmount || buyAmount)
    ) {
      const type = sellAmount ? "getBuyAmount" : "getSellAmount"
      const amount = sellAmount || buyAmount

      requestQuoteUpdate({
        type,
        amount,
        sellAsset,
        buyAsset,
      })
    }
  }, REFRESH_QUOTE_INTERVAL)

  useOnMount(() => {
    // Request a quote on mount
    if (sellAsset && buyAsset && sellAmount) {
      requestQuoteUpdate({
        type: "getBuyAmount",
        amount: sellAmount,
        sellAsset,
        buyAsset,
      })
    }
  })

  const handleExecuteSwap = useCallback(async () => {
    if (sellAsset && buyAsset && quote) {
      const finalQuote = (await dispatch(
        fetchSwapQuote(quote.quoteRequest)
      )) as unknown as AsyncThunkFulfillmentType<typeof fetchSwapQuote>

      if (finalQuote) {
        const { gasPrice, ...quoteWithoutGasPrice } = finalQuote

        await dispatch(
          executeSwap({
            ...quoteWithoutGasPrice,
            sellAsset,
            buyAsset,
            gasPrice:
              quote.swapTransactionSettings.networkSettings.values.maxFeePerGas.toString() ??
              gasPrice,
          })
        )
      }
    }
  }, [dispatch, sellAsset, buyAsset, quote])

  if (!NETWORKS_SUPPORTING_SWAPS.has(currentNetwork.chainID)) {
    return <Redirect to="/" />
  }

  const quoteAppliesToCurrentAmounts =
    quote &&
    (quote.type === "getBuyAmount"
      ? sellAmount === quote.amount && buyAmount === quote.quote
      : buyAmount === quote.amount && sellAmount === quote.quote)

  const isLoadingPriceDetails =
    loadingQuote || !quote?.priceDetails || !quoteAppliesToCurrentAssets

  return (
    <>
      <>
        <div className="standard_width">
          <div className="back_button_wrap">
            <SharedBackButton path="/" />
          </div>
          <div className="header">
            <SharedActivityHeader label={t("swap.title")} activity="swap" />
            <ReadOnlyNotice isLite />
            {isEnabled(FeatureFlags.HIDE_TOKEN_FEATURES) ? (
              <></>
            ) : (
              !isEnabled(FeatureFlags.HIDE_SWAP_REWARDS) && (
                // TODO: Add onClick function after design is ready
                <SharedIcon
                  icon="cog@2x.png"
                  width={20}
                  color="var(--green-60)"
                  hoverColor="#fff"
                  customStyles="margin: 17px 0 25px;"
                />
              )
            )}
          </div>
          {isEnabled(FeatureFlags.HIDE_TOKEN_FEATURES) ? (
            <></>
          ) : (
            isEnabled(FeatureFlags.HIDE_SWAP_REWARDS) && (
              <SharedBanner
                id="swap_rewards"
                canBeClosed
                icon="notif-announcement"
                iconColor="var(--link)"
                customStyles="margin-bottom: 16px"
              >
                {t("swap.swapRewardsTeaser")}
              </SharedBanner>
            )
          )}
          <div className="form">
            <div className="form_input">
              <SharedAssetInput<SwappableAsset>
                currentNetwork={currentNetwork}
                amount={sellAmount}
                amountMainCurrency={
                  sellAmount
                    ? quote?.priceDetails?.sellCurrencyAmount
                    : undefined
                }
                showPriceDetails
                isPriceDetailsLoading={isLoadingPriceDetails}
                assetsAndAmounts={sellAssetAmounts}
                selectedAsset={sellAsset}
                isDisabled={loadingSellAmount}
                onAssetSelect={updateSellAsset}
                onFocus={() => setAmountInputHasFocus(true)}
                onBlur={() => setAmountInputHasFocus(false)}
                onErrorMessageChange={(error) => setHasError(!!error)}
                mainCurrencySign={mainCurrencySign}
                onAmountChange={(newAmount, error) => {
                  setSellAmount(newAmount)

                  if (!error) {
                    requestQuoteUpdate({
                      type: "getBuyAmount",
                      amount: newAmount,
                      sellAsset,
                      buyAsset,
                    })
                  }
                }}
                label={t("swap.from")}
              />
            </div>
            <button
              className="icon_change"
              type="button"
              onClick={flipSwap}
              disabled={loadingQuote}
            >
              {t("swap.switchAssets")}
            </button>
            <div className="form_input">
              <SharedAssetInput<SwappableAsset>
                currentNetwork={currentNetwork}
                amount={buyAmount}
                amountMainCurrency={
                  buyAmount ? quote?.priceDetails?.buyCurrencyAmount : undefined
                }
                priceImpact={quote?.priceDetails?.priceImpact}
                isPriceDetailsLoading={isLoadingPriceDetails}
                showPriceDetails
                // FIXME: Merge master asset list with account balances.
                assetsAndAmounts={buyAssets.map((asset) => ({ asset }))}
                selectedAsset={buyAsset}
                isDisabled={loadingBuyAmount}
                onFocus={() => setAmountInputHasFocus(true)}
                onBlur={() => setAmountInputHasFocus(false)}
                showMaxButton={false}
                mainCurrencySign={mainCurrencySign}
                onAssetSelect={updateBuyAsset}
                onAmountChange={(newAmount, error) => {
                  setBuyAmount(newAmount)
                  if (error) {
                    requestQuoteUpdate.cancel()
                    return
                  }
                  if (newAmount) {
                    requestQuoteUpdate({
                      type: "getSellAmount",
                      amount: newAmount,
                      sellAsset,
                      buyAsset,
                    })
                  }
                }}
                label={t("swap.to")}
              />
            </div>
            <div className="footer standard_width_padded">
              {quoteAppliesToCurrentAssets && quote?.needsApproval ? (
                <ApproveQuoteBtn
                  isApprovalInProgress={!!isApprovalInProgress}
                  isDisabled={
                    isReadOnlyAccount || !quote || hasError || isLoading
                  }
                  onApproveClick={approveAsset}
                  isLoading={isLoading}
                />
              ) : (
                <SharedButton
                  type="primary"
                  size="large"
                  isDisabled={
                    isReadOnlyAccount ||
                    !quote ||
                    !quoteAppliesToCurrentAssets ||
                    !quoteAppliesToCurrentAmounts ||
                    hasError ||
                    isLoading
                  }
                  onClick={() => {
                    setIsLoading(true)
                    handleExecuteSwap()
                  }}
                  isLoading={isLoading}
                >
                  {t("swap.reviewSwap")}
                </SharedButton>
              )}
            </div>
          </div>
        </div>
      </>
      <style jsx>
        {`
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 13px;
          }
          .network_fee_group {
            display: flex;
            margin-bottom: 29px;
          }
          .label_right {
            margin-right: 6px;
          }
          .divider {
            width: 384px;
            border-bottom: 1px solid #000000;
            margin-left: -16px;
          }
          .total_amount_number {
            width: 150px;
            height: 32px;
            color: #e7296d;
            font-size: 22px;
            font-weight: 500;
            line-height: 32px;
          }

          .footer {
            display: flex;
            justify-content: center;
            margin-top: 24px;
          }
          .total_label {
            width: 33px;
            height: 17px;
            color: var(--green-60);
            font-size: 14px;
            font-weight: 400;
            letter-spacing: 0.42px;
            line-height: 16px;
          }
          .icon_change {
            display: block;
            background: url("./images/change@2x.png") center no-repeat;
            background-size: 20px 20px;
            width: 20px;
            height: 20px;
            padding: 8px;
            border: 3px solid var(--hunter-green);
            background-color: var(--green-95);
            border-radius: 70%;
            margin: 0 auto;
            margin-top: -5px;
            margin-bottom: -32px;
            position: relative;
            z-index: 1;
            font-size: 0;
          }
          .settings_wrap {
            margin-top: 16px;
          }
          .back_button_wrap {
            position: absolute;
            margin-left: -1px;
            margin-top: -4px;
            z-index: 10;
            background: white;
            width: 100%;
          }
        `}
      </style>
    </>
  )
}
