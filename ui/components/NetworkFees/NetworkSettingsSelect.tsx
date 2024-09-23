import React, { ReactElement, useCallback, useEffect, useState } from "react"
import { BlockEstimate } from "@pelagus/pelagus-background/networks"
import { ESTIMATED_FEE_MULTIPLIERS } from "@pelagus/pelagus-background/constants"
import {
  EstimatedFeesPerGas,
  NetworkFeeSettings,
  NetworkFeeTypeChosen,
  setCustomGas,
  GasOption,
  setCustomGasLimit,
} from "@pelagus/pelagus-background/redux-slices/transaction-construction"

import { weiToGwei } from "@pelagus/pelagus-background/lib/utils"
import { PricePoint } from "@pelagus/pelagus-background/assets"
import {
  selectTransactionData,
  selectTransactionMainCurrencyPricePoint,
} from "@pelagus/pelagus-background/redux-slices/selectors/transactionConstructionSelectors"
import { useTranslation } from "react-i18next"
import { SharedTypedInput } from "../Shared/SharedInput"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"

import {
  NetworkSettingsSelectOptionButton,
  NetworkSettingsSelectOptionButtonCustom,
} from "./NetworkSettingsSelectOptionButtons"
import SharedButton from "../Shared/SharedButton"
import SharedBanner from "../Shared/SharedBanner"
import { ESTIMATED_SPEED_IN_READABLE_FORMAT_RELATIVE_TO_CONFIDENCE_LEVEL } from "../../utils/constants"

interface NetworkSettingsSelectProps {
  estimatedFeesPerGas: EstimatedFeesPerGas | undefined
  networkSettings: NetworkFeeSettings
  onNetworkSettingsChange: (newSettings: NetworkFeeSettings) => void
  onSave: () => void
}

// Map a BlockEstimate from the backend to a GasOption for the UI.
const gasOptionFromEstimate = (
  mainCurrencyPricePoint: PricePoint | undefined,
  baseFeePerGas: bigint,
  gasLimit: bigint | undefined,
  { confidence, maxFeePerGas, maxPriorityFeePerGas, price }: BlockEstimate
): GasOption => {
  const feeOptionData: {
    [confidence: number]: NetworkFeeTypeChosen
  } = {
    1: NetworkFeeTypeChosen.Auto,
    70: NetworkFeeTypeChosen.Regular,
    95: NetworkFeeTypeChosen.Express,
    99: NetworkFeeTypeChosen.Instant,
    0: NetworkFeeTypeChosen.Custom,
  }

  if (feeOptionData[confidence] === NetworkFeeTypeChosen.Auto) {
    return {
      confidence: `${confidence}`,
      estimatedSpeed: "",
      type: feeOptionData[confidence],
      estimatedGwei: "",
      maxPriorityGwei: "",
      maxGwei: "",
      dollarValue: "-",
      estimatedFeePerGas: 0n,
      baseMaxFeePerGas: 0n,
      baseMaxGwei: "",
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
      gasPrice: "",
    }
  }

  return {
    confidence: `${confidence}`,
    estimatedSpeed:
      ESTIMATED_SPEED_IN_READABLE_FORMAT_RELATIVE_TO_CONFIDENCE_LEVEL[
        confidence
      ],
    type: feeOptionData[confidence],
    estimatedGwei: weiToGwei(
      (baseFeePerGas * ESTIMATED_FEE_MULTIPLIERS[confidence]) / 10n
    ).split(".")[0],
    maxPriorityGwei: weiToGwei(maxPriorityFeePerGas),
    maxGwei: weiToGwei(maxFeePerGas).split(".")[0],
    dollarValue: "-",
    estimatedFeePerGas:
      (baseFeePerGas * ESTIMATED_FEE_MULTIPLIERS[confidence]) / 10n,
    baseMaxFeePerGas: BigInt(maxFeePerGas) - BigInt(maxPriorityFeePerGas),
    baseMaxGwei: weiToGwei(BigInt(maxFeePerGas) - BigInt(maxPriorityFeePerGas)),
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasPrice: price?.toString(),
  }
}

export default function NetworkSettingsSelect({
  // FIXME Map this to GasOption[] in a selector.
  estimatedFeesPerGas,
  networkSettings,
  onNetworkSettingsChange,
  onSave,
}: NetworkSettingsSelectProps): ReactElement {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()

  const [gasOptions, setGasOptions] = useState<GasOption[]>([])
  const customGas = useBackgroundSelector((state) => {
    return state.transactionConstruction.customFeesPerGas
  })

  const [activeFeeIndex, setActiveFeeIndex] = useState(0)
  const [currentlySelectedType, setCurrentlySelectedType] = useState(
    networkSettings.feeType
  )

  const transactionDetails = useBackgroundSelector(selectTransactionData)

  const mainCurrencyPricePoint = useBackgroundSelector(
    selectTransactionMainCurrencyPricePoint
  )

  useEffect(() => {
    // Base fee should not be below 1 gwei unless user-specified
    if (estimatedFeesPerGas?.baseFeePerGas ?? 0n < 1000000000n) {
      estimatedFeesPerGas != undefined
        ? (estimatedFeesPerGas.baseFeePerGas = 1000000000n)
        : 1000000000n
    }
  }, [estimatedFeesPerGas])

  // Select activeFeeIndex to regular option once gasOptions load
  useEffect(() => {
    if (gasOptions.length > 0) {
      onNetworkSettingsChange({
        feeType: gasOptions[activeFeeIndex].type,
        values: {
          maxFeePerGas: gasOptions[activeFeeIndex].maxFeePerGas,
          maxPriorityFeePerGas: gasOptions[activeFeeIndex].maxPriorityFeePerGas,
        },
        gasLimit: networkSettings.gasLimit,
        suggestedGasLimit: networkSettings.suggestedGasLimit,
      })
    }
  }, [
    gasOptions,
    activeFeeIndex,
    onNetworkSettingsChange,
    networkSettings.gasLimit,
    networkSettings.suggestedGasLimit,
  ])

  const handleSelectGasOption = (index: number) => {
    setActiveFeeIndex(index)
    setCurrentlySelectedType(gasOptions[index].type)
    onNetworkSettingsChange({
      feeType: gasOptions[index].type,
      values: {
        maxFeePerGas: gasOptions[index].maxFeePerGas,
        maxPriorityFeePerGas: gasOptions[index].maxPriorityFeePerGas,
      },
      gasLimit: networkSettings.gasLimit,
      suggestedGasLimit: networkSettings.suggestedGasLimit,
    })
  }

  const updateGasOptions = useCallback(() => {
    if (typeof estimatedFeesPerGas !== "undefined") {
      const { regular, express, instant, custom } = estimatedFeesPerGas ?? {}
      const gasLimit =
        networkSettings.gasLimit ?? networkSettings.suggestedGasLimit

      if (typeof instant !== "undefined") {
        const autoFee = {
          confidence: 1,
          maxFeePerGas: 1000000000n,
          maxPriorityFeePerGas: 1000000000n,
        }
        const baseFees = [autoFee, regular, express, instant, custom]

        const updatedGasOptions: GasOption[] = []

        baseFees.forEach((option) => {
          if (option) {
            // Basefee minimum is 1 gwei
            if (estimatedFeesPerGas.baseFeePerGas ?? 0n < 1000000000n) {
              estimatedFeesPerGas.baseFeePerGas = 1000000000n
            }
            updatedGasOptions.push(
              gasOptionFromEstimate(
                mainCurrencyPricePoint,
                estimatedFeesPerGas.baseFeePerGas ?? 1000000000n,
                gasLimit,
                option
              )
            )
          }
        })

        if (customGas) {
          updatedGasOptions.push(
            gasOptionFromEstimate(
              mainCurrencyPricePoint,
              estimatedFeesPerGas.baseFeePerGas ?? 1000000000n,
              gasLimit,
              customGas
            )
          )
        }

        const selectedGasFeeIndex = updatedGasOptions.findIndex(
          (el) => el.type === currentlySelectedType
        )
        const currentlySelectedFeeIndex =
          selectedGasFeeIndex === -1 ? 0 : selectedGasFeeIndex

        setGasOptions(updatedGasOptions)
        setActiveFeeIndex(currentlySelectedFeeIndex)
      }
    }
  }, [
    estimatedFeesPerGas,
    networkSettings.gasLimit,
    networkSettings.suggestedGasLimit,
    mainCurrencyPricePoint,
    customGas,
    currentlySelectedType,
  ])

  useEffect(() => {
    updateGasOptions()
  }, [updateGasOptions])

  const setGasLimit = async (gasLimit: bigint | undefined) => {
    await dispatch(
      setCustomGasLimit(gasLimit ?? networkSettings.suggestedGasLimit)
    )
    onNetworkSettingsChange({ ...networkSettings, gasLimit })
  }

  function updateCustomGas(
    customMaxBaseFee: bigint,
    customMaxPriorityFeePerGas: bigint
  ) {
    dispatch(
      setCustomGas({
        maxPriorityFeePerGas: customMaxPriorityFeePerGas,
        maxFeePerGas:
          BigInt(customMaxBaseFee) + BigInt(customMaxPriorityFeePerGas),
      })
    )
  }

  return (
    <div className="fees standard_width">
      <span className="settings_label network_fee_label">
        {t("networkFees.settingsTitle")}
      </span>
      {gasOptions.map((option, i) => {
        return (
          <>
            {option.type === "custom" ? (
              <NetworkSettingsSelectOptionButtonCustom
                key={option.type}
                option={option}
                isActive={i === activeFeeIndex}
                handleSelectGasOption={() => handleSelectGasOption(i)}
                updateCustomGas={(
                  customMaxBaseFee: bigint,
                  customMaxPriorityFeePerGas: bigint
                ) =>
                  updateCustomGas(customMaxBaseFee, customMaxPriorityFeePerGas)
                }
              />
            ) : (
              <NetworkSettingsSelectOptionButton
                key={option.type}
                option={option}
                isActive={i === activeFeeIndex}
                handleSelectGasOption={() => handleSelectGasOption(i)}
              />
            )}
          </>
        )
      })}
      <footer>
        {transactionDetails?.annotation?.warnings?.includes(
          "insufficient-funds"
        ) && (
          <SharedBanner icon="notif-attention" iconColor="var(--error)">
            <span className="warning_text">
              {t("networkFees.insufficientBaseAsset", {
                symbol: transactionDetails.network.baseAsset.symbol,
              })}
            </span>
          </SharedBanner>
        )}
        <div className="info">
          <div className="limit">
            <SharedTypedInput
              id="gasLimit"
              value={networkSettings.gasLimit?.toString() ?? ""}
              placeholder={networkSettings.suggestedGasLimit?.toString() ?? ""}
              onChange={setGasLimit}
              parseAndValidate={(value) => {
                if (value.trim() === "") {
                  return { parsed: undefined }
                }
                try {
                  const parsed = BigInt(value)
                  // @TODO Consider nontypical gas minimums when adding networks
                  if (parsed < 21000n) {
                    return {
                      error: t("networkFees.errors.limitTooLow"),
                    }
                  }

                  return { parsed }
                } catch (e) {
                  return { error: t("networkFees.errors.invalidLimit") }
                }
              }}
              label={t("networkFees.gasLimit")}
              type="number"
              focusedLabelBackgroundColor="var(--green-95)"
              step={1000}
            />
          </div>
          <div className="max_fee">
            <span className="max_label">{t("networkFees.totalMax")}</span>
            <div className="price ellipsis">
              {gasOptions?.[activeFeeIndex]?.maxGwei} {t("shared.gwei")}
            </div>
          </div>
        </div>
        <div className="confirm">
          <SharedButton size="medium" type="primary" onClick={onSave}>
            {t("networkFees.saveSettings")}
          </SharedButton>
        </div>
      </footer>
      <style jsx>
        {`
          .settings_label {
            color: var(--green-5);
            font-weight: 600;
            font-size: 18px;
            line-height: 24px;
          }
          .network_fee_label {
            width: 100%;
            display: block;
            margin-bottom: 10px;
          }
          .max_fee {
            display: flex;
            flex-flow: column;
            margin-right: 10px;
            align-items: flex-end;
          }
          .price {
            width: 176px;
            text-align: right;
          }
          .max_label {
            font-size: 14px;
            color: var(--green-40);
          }
          .info {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          footer {
            position: fixed;
            bottom: 16px;
            width: inherit;
          }
          .limit {
            margin: 16px 0;
            width: 40%;
            position: relative;
          }
          .confirm {
            float: right;
          }
          .warning_text {
            font-size: 16px;
            line-height: 24px;
            font-weight: 500;
            color: var(--error);
          }
        `}
      </style>
    </div>
  )
}
