import React, { ReactElement, useEffect, useState } from "react"
import {
  selectEstimatedFeesPerGas,
  selectTransactionData,
} from "@pelagus/pelagus-background/redux-slices/selectors/transactionConstructionSelectors"
import { updateTransactionData } from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import { useTranslation } from "react-i18next"
import classNames from "classnames"
import { getGasPrice, getABIFromAddress, selectAssetPricePoint, estimateGas } from "@pelagus/pelagus-background/redux-slices/assets"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/transactions/types"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedSlideUpMenu from "../../../Shared/SharedSlideUpMenu"
import NetworkSettingsChooser from "../../../NetworkFees/NetworkSettingsChooser"
import FeeSettingsButton from "../../../NetworkFees/FeeSettingsButton"
import TransactionSignatureDetailsWarning from "./TransactionSignatureDetailsWarning"
import { Interface, ParamType, formatQuai } from "quais"
import logger from "@pelagus/pelagus-background/lib/logger"
import { QUAI } from "@pelagus/pelagus-background/constants/base-assets"
import { enrichAssetAmountWithMainCurrencyValues } from "@pelagus/pelagus-background/redux-slices/utils/asset-utils"

export type PanelState = {
  dismissedWarnings: string[]
}

type DetailPanelProps = {
  transactionRequest?: QuaiTransactionRequestWithAnnotation
  defaultPanelState?: PanelState
}

type DecodedCall = {
  name: string;
  signature: string;
  params: { name: string; type: string; value: unknown }[];
};

export default function DetailPanel({
  transactionRequest,
  defaultPanelState,
}: DetailPanelProps): ReactElement {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()
  const reduxTransactionData = useBackgroundSelector(selectTransactionData)
  const estimatedFeesPerGas = useBackgroundSelector(selectEstimatedFeesPerGas)

  const [updateNum, setUpdateNum] = useState(0)
  const [transactionDetails, setTransactionDetails] =
    useState(reduxTransactionData)
  const [panelState, setPanelState] = useState(
    defaultPanelState ?? { dismissedWarnings: [] }
  )
  const [abi, setABI] = useState<Interface | undefined>(undefined)
  const [decodedCall, setDecodedCall] = useState<DecodedCall | undefined>(undefined)
  const [networkSettingsModalOpen, setNetworkSettingsModalOpen] = useState(false)
  const [txFeeInUSD, setTxFeeInUSD] = useState<string | undefined>(undefined)

  const quaiUsdPricePoint = useBackgroundSelector((state) =>
    selectAssetPricePoint(state.assets, QUAI, "USD")
  )

  useEffect(() => {
    if (!transactionRequest) return
    setTransactionDetails(transactionRequest)
    dispatch(updateTransactionData(transactionRequest))
    const fetchABI = async () => {
      if (transactionRequest?.to) {
        const fetchedAbi = await dispatch(getABIFromAddress({ address: transactionRequest.to }))
        setABI(Interface.from(fetchedAbi as any))
      }
    }
    
    fetchABI()
  }, [])

  useEffect(() => {
    if (!abi || !transactionRequest?.data) return;
  
    try {
  
      // parseTransaction works even if the tx has a `value`
      const parsed = abi.parseTransaction({
        data: transactionRequest.data,
      });
      if (!parsed) throw new Error("Could not parse transaction")


      const params: { name: string; type: string; value: unknown }[] = []

      params.push({
        name: "from",
        type: "your address",
        value: transactionRequest.from,
      })
  
      parsed.args.map((arg: unknown, i: number) => {
        const input: ParamType = parsed.fragment.inputs[i];
        const name = input.name || `arg${i}`
        params.push({
          name,
          type: input.type,
          value: arg,
        });
      });
  
      setDecodedCall({
        name: parsed.name,
        signature: parsed.signature,
        params,
      });
    } catch (err) {
      logger.warn("Could not decode calldata", err);
      setDecodedCall(undefined);
    }
  }, [abi, transactionRequest?.data]);

  useEffect(() => {
    const fetchGasPrices = async () => {
      if (
        transactionDetails &&
        transactionDetails.from &&
        transactionDetails.network
      ) {
        const { gasPrice } = (await dispatch(
          getGasPrice()
        )) as unknown as AsyncThunkFulfillmentType<typeof getGasPrice>
        if (!estimatedFeesPerGas) return

        if (estimatedFeesPerGas.regular) {
          estimatedFeesPerGas.regular.gasPrice = gasPrice
        }
        estimatedFeesPerGas.gasPrice = gasPrice

        let gasLimit = transactionDetails.gasLimit

        if(!gasLimit) {
          if (!transactionRequest) return
          const estimatedGas = await dispatch(estimateGas(transactionRequest)) as AsyncThunkFulfillmentType<typeof estimateGas>
          if (estimatedGas === 0n) {
            logger.error("transactionDetails.gasLimit is undefined and estimating gas failed")
            return
          }
          gasLimit = estimatedGas
        }
        let txFeeInQuai = estimatedFeesPerGas?.gasPrice * BigInt(gasLimit)
        const enrichedAmount = enrichAssetAmountWithMainCurrencyValues(
          {
            asset: QUAI,
            amount: txFeeInQuai
          },
          quaiUsdPricePoint,
          3
        )
        setTxFeeInUSD(enrichedAmount.localizedMainCurrencyAmount ?? undefined)
      }
    }

    fetchGasPrices()
  }, [transactionDetails, estimatedFeesPerGas, dispatch])

  if (transactionDetails === undefined) return <></>

  const hasInsufficientFundsWarning =
    transactionDetails.annotation?.warnings?.includes("insufficient-funds")

  const isContractAddress =
    transactionDetails.annotation?.warnings?.includes("send-to-contract")

  const networkSettingsSaved = () => {
    setUpdateNum(updateNum + 1)
    setNetworkSettingsModalOpen(false)
  }

  const getHightForSlideUpMenu = () => {
    return `${3 * 56 + 320 + (hasInsufficientFundsWarning ? 15 : 0)}px`
  }

  return (
    <div className="detail_items_wrap standard_width_padded">
      <SharedSlideUpMenu
        size="custom"
        isOpen={networkSettingsModalOpen}
        close={() => setNetworkSettingsModalOpen(false)}
        customSize={getHightForSlideUpMenu()}
      >
        <NetworkSettingsChooser
          estimatedFeesPerGas={estimatedFeesPerGas}
          onNetworkSettingsSave={networkSettingsSaved}
        />
      </SharedSlideUpMenu>
      {isContractAddress &&
        !panelState.dismissedWarnings.includes("send-to-contract") && (
          <span className="detail_item">
            <TransactionSignatureDetailsWarning
              message={t("wallet.sendToContractWarning")}
              dismissable
              onDismiss={() =>
                setPanelState((state) => ({
                  ...state,
                  dismissedWarnings: [
                    ...state.dismissedWarnings,
                    "send-to-contract",
                  ],
                }))
              }
            />
          </span>
        )}
      <span className="detail_item">
        <div className="detail_label">
          {t("networkFees.estimatedNetworkFee")}
        </div>
      </span>
      <span className="detail_item fee_details">
        <div className="fee_controls">
          <FeeSettingsButton onClick={() => setNetworkSettingsModalOpen(true)} />
          {txFeeInUSD !== undefined && (
            <span className="usd_value">
              (~${txFeeInUSD} USD)
            </span>
          )}
        </div>
      </span>

      <span
        className={classNames("detail_item warning", {
          visible: hasInsufficientFundsWarning,
        })}
      >
        <TransactionSignatureDetailsWarning
          message={t("networkFees.insufficientBaseAsset", {
            symbol: transactionDetails.network.baseAsset.symbol,
          })}
        />
      </span>
      {decodedCall && (
        <div className="detail_item decoded_call">
          <div className="detail_label">
          <strong>{t("signTransaction.callingFunction") + " "} </strong>
          <span className="function_name">{decodedCall.name}</span>
          </div>
          <br />
          <ul className="param_list">
            {decodedCall.params.map((p) => (
              <li key={p.name} className="param_item">
                <div className="param_header">
                  <span className="param_name">{p.name}</span>
                  <span className="param_type">({p.type})</span>
                </div>
                <div className="param_value_container">
                  <span className="param_value">{String(p.value)}</span>
                </div>
                { (p.name === "amountOutMin" || p.name === "amountIn" || p.name === "amountMin") && (
                  <div className="param_value_container">
                    <span className="param_value">{"(" + Number(formatQuai(p.value as bigint)).toFixed(5).toString() + " parsed as 18 decimals)"}</span>
                  </div>  
                )}
                <br />
              </li>
            ))}
          </ul>
        </div>
      )}
      <style jsx>
        {`
          .detail_item {
            width: 100%;
            color: var(--primary-text);
            font-size: 14px;
            line-height: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .detail_items_wrap {
            display: flex;
            margin-top: 21px;
            gap: 10px;
            flex-direction: column;
          }
          .detail_item_right {
            color: var(--green-20);
            font-size: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .detail_label {
            font-weight: 500;
            font-size: 14px;
            line-height: 16px;
            letter-spacing: 0.03em;
          }
          .warning {
            width: 100%;
            max-height: 0;
            transform: translateX(calc(-100% - 24px));
            transition: transform ease-out 0.2s, max-height ease-out 0.2s;
          }
          .warning.visible {
            transform: translateX(0);
            max-height: 55px;
          }
          .decoded_call {
            flex-direction: column;
            align-items: flex-start;
            width: 100%;
          }
          .param_list { 
            margin: 0; 
            padding: 0;
            list-style: none;
            font-size: 13px;
            width: 100%;
            margin-top: 8px;
          }
          .param_item {
            margin-bottom: 12px;
            border-bottom: 1px solid var(--green-80);
            padding-bottom: 8px;
          }
          .param_header {
            display: flex;
            align-items: center;
            margin-bottom: 4px;
          }
          .param_name { 
            font-weight: 800; 
            font-size: medium;
            margin-right: 4px;
            color: var(--green-20);
          }
          .param_type { 
            color: var(--green-20); 
            font-size: medium;
            font-weight: 800;
          }
          .function_name {
            font-size: large;
            font-weight: 800;
          }
          .param_value_container {
            word-break: break-all;
            overflow-wrap: break-word;
            max-width: 100%;
          }
          .param_value {
            font-size: 13px;
            background-color: var(--green-90);
            padding: 2px 4px;
            border-radius: 3px;
            display: inline-block;
            max-width: 100%;
          }
          .fee_details {
            margin-top: -8px;
            margin-bottom: 8px;
          }
          .fee_controls {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .usd_value {
            color: var(--secondary-text);
            font-size: 14px;
          }
        `}
      </style>
    </div>
  )
}
