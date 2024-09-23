import React, { ReactElement } from "react"
import {
  truncateDecimalAmount,
  weiToGwei,
} from "@pelagus/pelagus-background/lib/utils"
import {
  NetworkFeeSettings,
  NetworkFeeTypeChosen,
} from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import {
  enrichAssetAmountWithMainCurrencyValues,
  heuristicDesiredDecimalsForUnitPrice,
} from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"
import {
  selectDefaultNetworkFeeSettings,
  selectEstimatedFeesPerGas,
  selectTransactionData,
  selectTransactionMainCurrencyPricePoint,
} from "@pelagus/pelagus-background/redux-slices/selectors/transactionConstructionSelectors"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { useTranslation } from "react-i18next"
import {
  assetAmountToDesiredDecimals,
  PricePoint,
  unitPricePointForPricePoint,
} from "@pelagus/pelagus-background/assets"
import { NetworkInterface } from "@pelagus/pelagus-background/constants/networks/networkTypes"
import { useBackgroundSelector } from "../../hooks"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/transactions/types"

const getFeeDollarValue = (
  currencyPrice: PricePoint | undefined,
  gasLimit?: bigint,
  estimatedSpendPerGas?: bigint,
  estimatedL1RollupFee?: bigint
): string | undefined => {
  if (estimatedSpendPerGas) {
    if (!gasLimit || !currencyPrice) return undefined

    const [asset] = currencyPrice.pair

    let currencyCostPerBaseAsset
    const unitPricePoint = unitPricePointForPricePoint(currencyPrice)

    if (unitPricePoint) {
      currencyCostPerBaseAsset = assetAmountToDesiredDecimals(
        unitPricePoint.unitPrice,
        2
      )
    }

    const { localizedMainCurrencyAmount } =
      enrichAssetAmountWithMainCurrencyValues(
        {
          asset,
          amount:
            estimatedSpendPerGas * gasLimit + (estimatedL1RollupFee ?? 0n),
        },
        currencyPrice,
        currencyCostPerBaseAsset && currencyCostPerBaseAsset < 1 ? 4 : 2
      )
    return localizedMainCurrencyAmount
  }
  return undefined
}

const estimateGweiAmount = (options: {
  baseFeePerGas: bigint
  networkSettings: NetworkFeeSettings
  network: NetworkInterface
  transactionData?: QuaiTransactionRequestWithAnnotation
}): string => {
  const { networkSettings, baseFeePerGas } = options
  const estimatedSpendPerGas =
    baseFeePerGas + networkSettings.values.maxPriorityFeePerGas

  const desiredDecimals = 0

  const estimatedSpendPerGasInGwei = weiToGwei(estimatedSpendPerGas ?? 0n)
  const decimalLength = heuristicDesiredDecimalsForUnitPrice(
    desiredDecimals,
    Number(estimatedSpendPerGasInGwei)
  )
  return truncateDecimalAmount(estimatedSpendPerGasInGwei, decimalLength)
}

export default function FeeSettingsText({
  customNetworkSetting,
}: {
  customNetworkSetting?: NetworkFeeSettings
}): ReactElement {
  const { t } = useTranslation()
  const transactionData = useBackgroundSelector(selectTransactionData)
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)
  const estimatedFeesPerGas = useBackgroundSelector(selectEstimatedFeesPerGas)
  let networkSettings = useBackgroundSelector(selectDefaultNetworkFeeSettings)
  networkSettings = customNetworkSetting ?? networkSettings
  const baseFeePerGas =
    useBackgroundSelector((state) => {
      return state.networks.blockInfo[selectedNetwork.chainID]?.baseFeePerGas
    }) ??
    networkSettings.values?.baseFeePerGas ??
    0n

  const mainCurrencyPricePoint = useBackgroundSelector(
    selectTransactionMainCurrencyPricePoint
  )
  const estimatedGweiAmount = estimateGweiAmount({
    baseFeePerGas,
    networkSettings,
    transactionData,
    network: selectedNetwork,
  })

  const gasLimit = networkSettings.gasLimit ?? networkSettings.suggestedGasLimit
  const estimatedSpendPerGas =
    networkSettings.values.gasPrice ||
    baseFeePerGas + networkSettings.values.maxPriorityFeePerGas

  if (typeof estimatedFeesPerGas === "undefined")
    return <div>{t("networkFees.unknownFee")}</div>

  if (networkSettings.feeType === NetworkFeeTypeChosen.Auto)
    return <div style={{ padding: "0 8px" }}>Auto</div>

  const estimatedRollupFee = 0n

  const gweiValue = `${estimatedGweiAmount} Gwei`
  const dollarValue = getFeeDollarValue(
    mainCurrencyPricePoint,
    gasLimit,
    estimatedSpendPerGas,
    estimatedRollupFee
  )

  if (!dollarValue) return <div>~{gweiValue}</div>

  return (
    <div className="fee_settings_text_container">
      {!gasLimit ? (
        <>{t("networkFees.toBeDetermined")}</>
      ) : (
        <>
          <span>~${dollarValue}</span>
          <span className="fee_gwei">({gweiValue})</span>
        </>
      )}
      <style jsx>{`
        .fee_gwei {
          color: var(--green-60);
          margin-left: 5px;
        }
        .fee_settings_text_container {
          display: flex;
          justify-content: space-around;
          flex-wrap: wrap;
        }
      `}</style>
    </div>
  )
}
