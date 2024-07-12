import { unitPricePointForPricePoint } from "@pelagus/pelagus-background/assets"
import { selectAssetPricePoint } from "@pelagus/pelagus-background/redux-slices/assets"
import { selectMainCurrencySymbol } from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  enrichAssetAmountWithDecimalValues,
  heuristicDesiredDecimalsForUnitPrice,
} from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { toBigInt } from "quais"
import { TransactionSignatureSummaryProps } from "./TransactionSignatureSummaryProps"
import { useBackgroundSelector } from "../../../../../hooks"
import { TransferSummaryBase } from "./TransferSummary"

/**
 * This summary is used in case other summaries cannot be resolved. This
 * generally means the transaction had no enrichment annotations, so it is
 * treated as base asset transfer.
 *
 * Note that in general this should not happen, and if we reach this stage it's
 * likely something has gone wrong in enrichment, since enrichment should
 * annotate a base asset transfer with an AssetTransfer annotation.
 */
export default function TransactionSignatureSummaryDefault({
  transactionRequest,
}: TransactionSignatureSummaryProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "signTransaction",
  })
  const { network } = transactionRequest

  const mainCurrencySymbol = useBackgroundSelector(selectMainCurrencySymbol)
  const baseAssetPricePoint = useBackgroundSelector((state) =>
    selectAssetPricePoint(state.assets, network.baseAsset, mainCurrencySymbol)
  )

  // TODO-MIGRATION
  const amountValue = transactionRequest.value
    ? toBigInt(transactionRequest.value)
    : 0n
  const transactionAssetAmount = enrichAssetAmountWithDecimalValues(
    {
      asset: network.baseAsset,
      amount: amountValue,
    },
    heuristicDesiredDecimalsForUnitPrice(
      2,
      typeof baseAssetPricePoint !== "undefined"
        ? unitPricePointForPricePoint(baseAssetPricePoint)
        : undefined
    )
  )

  return (
    <TransferSummaryBase
      title={t("title")}
      assetAmount={transactionAssetAmount}
      recipientAddress={transactionRequest.to?.toString() ?? "-"}
    />
  )
}
