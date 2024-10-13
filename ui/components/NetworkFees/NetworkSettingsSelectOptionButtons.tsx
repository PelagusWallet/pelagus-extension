import React, { ReactElement, useState } from "react"
import { gweiToWei } from "@pelagus/pelagus-background/lib/utils"
import {
  GasOption,
  NetworkFeeTypeChosen,
} from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import classNames from "classnames"
import { useTranslation } from "react-i18next"
import SharedInput from "../Shared/SharedInput"
import { useBackgroundSelector } from "../../hooks"
import { NETWORK_FEE_CHOSEN_TYPE_TO_HUMAN_READABLE_TYPE } from "../../utils/constants"

const buttonStyle = `
  .subtext_large {
    font-weight: 500;
    font-size: 16px;
    color: var(--green-40);
  }
  .network_option {
    width: 100%;
    height: 50px;
    padding: 0px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--hunter-green);
    box-sizing: border-box;
    margin: 8px 0;
    cursor: pointer;
    border-radius: 4px;
    border: 1px solid transparent;
    position: relative;
  }
  .network_option.active {
    border-color: var(--success);
    box-shadow: 0px 16px 16px rgba(0, 20, 19, 0.14),
      0px 6px 8px rgba(0, 20, 19, 0.24), 0px 2px 4px rgba(0, 20, 19, 0.34);
  }
  .network_option.active .name {
    color: var(--success);
  }
  .network_option_left,
  .network_option_right {
    display: flex;
  }
  .network_option_right {
    align-items: center;
    justify-content: space-between;
  }
  .network_option_left {
    text-align: left;
    flex-direction: column;
    width: 70px;
  }
  .name,
  .price {
    color: var(--green--5);
  }
  .subtext {
    color: var(--green-60);
    font-size: 14px;
  }
  .max_fee {
    display: flex;
    flex-flow: column;
    margin-right: 10px;
    align-items: flex-end;
  }
  .max_r_label {
    font-size: 14px;
    color: var(--green-40);
  }
  .currently_selected {
    color: var(--success);
    opacity: 0.8;
    font-size: 10px;
  }
  .r_label {
    padding-right: 5px;
  }
  .miner_wrap {
    max-width: 116px;
    display: flex;
    align-items: center;
  }
`

export function NetworkSettingsSelectOptionButton({
  option,
  handleSelectGasOption,
  isActive,
}: {
  option: GasOption
  handleSelectGasOption: () => void
  isActive: boolean
}): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "networkFees" })
  return (
    <button
      key={option.confidence}
      className={classNames("network_option", {
        active: isActive,
      })}
      onClick={handleSelectGasOption}
      type="button"
    >
      <div className="network_option_left">
        <div className="name">
          {NETWORK_FEE_CHOSEN_TYPE_TO_HUMAN_READABLE_TYPE[option.type]}
        </div>
        <div className="subtext">{option.estimatedSpeed}</div>
      </div>

      <div className="network_option_right">
        <div className="miner_wrap">
          <span className="subtext_large miner">
            <span className="r_label">{t("miner")}</span>
            {`${
              option.type !== NetworkFeeTypeChosen.Auto
                ? Number(option.minerTipGwei).toFixed(2)
                : "Auto"
            }`}
          </span>
        </div>
        <span className="subtext_large large r_label">{t("maxBase")} </span>
        <div className="price">
          {`${
            option.type !== NetworkFeeTypeChosen.Auto
              ? Number(option.minerTipGwei).toFixed(2)
              : "Auto"
          }`}
        </div>
      </div>
      <style jsx>
        {`
          ${buttonStyle}
          .miner {
            margin-right: 14px;
          }
        `}
      </style>
    </button>
  )
}

export function NetworkSettingsSelectOptionButtonCustom({
  option,
  handleSelectGasOption,
  isActive,
  updateCustomGas,
}: {
  option: GasOption
  handleSelectGasOption: () => void
  isActive: boolean
  updateCustomGas: (
    customMinerTip: bigint,
    customGasPrice: bigint
  ) => void
}): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "networkFees" })
  const [warningMessage, setWarningMessage] = useState("")
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)
  const baseGasFee = useBackgroundSelector(
    (state) => state.networks.blockInfo[selectedNetwork.chainID].baseFeePerGas
  )

  return (
    <button
      key={option.confidence}
      className={classNames("network_option", {
        active: isActive,
        network_option_warning: warningMessage,
      })}
      onClick={handleSelectGasOption}
      type="button"
    >
      <div className="network_option_left">
        <div className="name">
          {NETWORK_FEE_CHOSEN_TYPE_TO_HUMAN_READABLE_TYPE[option.type]}
        </div>
      </div>

      <div className="network_option_right">
        <div className="miner_wrap">
          <span className="subtext_large r_label">{t("miner")}</span>
          <div className="input_wrap">
            <SharedInput
              value={`${option.minerTip}`}
              isSmall
              type="number"
              onChange={(value: string) => {
                updateCustomGas(
                  gweiToWei(parseFloat(value)),
                  BigInt(option.gasPrice ?? 0n)
                )
              }}
              maxLength={4}
            />
          </div>
        </div>

        <span className="subtext_large r_label">{t("maxBase")}</span>
        <div className="input_wrap">
          <SharedInput
            value={`${option.gasPrice}`}
            isSmall
            type="number"
            onChange={(value: string) => {
              updateCustomGas(
                BigInt(option.minerTip ?? 0n),
                gweiToWei(parseFloat(value))
              ) 
              if (baseGasFee && gweiToWei(parseFloat(value)) < baseGasFee) {
                setWarningMessage(t("errors.lowGas"))
              } else {
                setWarningMessage("")
              }
            }}
            maxLength={12}
            warningMessage={warningMessage}
          />
        </div>
      </div>
      <style jsx>
        {`
          ${buttonStyle}
          .miner_wrap {
            width: 112px;
          }
          .network_option_warning {
            align-items: baseline;
            padding-top: 11px;
            height: 74px;
          }
        `}
      </style>
    </button>
  )
}
