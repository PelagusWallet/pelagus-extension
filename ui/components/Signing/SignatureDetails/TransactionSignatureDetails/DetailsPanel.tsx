import React, { ReactElement, useEffect, useState } from "react"
import {
  selectEstimatedFeesPerGas,
  selectTransactionData,
} from "@pelagus/pelagus-background/redux-slices/selectors/transactionConstructionSelectors"
import { updateTransactionData } from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import { useTranslation } from "react-i18next"
import classNames from "classnames"
import { getMaxFeeAndMaxPriorityFeePerGas } from "@pelagus/pelagus-background/redux-slices/assets"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/chain/types"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedSlideUpMenu from "../../../Shared/SharedSlideUpMenu"
import NetworkSettingsChooser from "../../../NetworkFees/NetworkSettingsChooser"
import FeeSettingsButton from "../../../NetworkFees/FeeSettingsButton"
import TransactionSignatureDetailsWarning from "./TransactionSignatureDetailsWarning"

export type PanelState = {
  dismissedWarnings: string[]
}

type DetailPanelProps = {
  transactionRequest?: QuaiTransactionRequestWithAnnotation
  defaultPanelState?: PanelState
}

export default function DetailPanel({
  transactionRequest,
  defaultPanelState,
}: DetailPanelProps): ReactElement {
  const [panelState, setPanelState] = useState(
    defaultPanelState ?? { dismissedWarnings: [] }
  )
  const [networkSettingsModalOpen, setNetworkSettingsModalOpen] =
    useState(false)
  const [updateNum, setUpdateNum] = useState(0)

  const estimatedFeesPerGas = useBackgroundSelector(selectEstimatedFeesPerGas)

  const reduxTransactionData = useBackgroundSelector(selectTransactionData)

  const [transactionDetails, setTransactionDetails] =
    useState(reduxTransactionData)

  const dispatch = useBackgroundDispatch()

  const { t } = useTranslation()

  useEffect(() => {
    if (!transactionRequest) return
    setTransactionDetails(transactionRequest)
    dispatch(updateTransactionData(transactionRequest))
  }, [])

  useEffect(() => {
    if (
      transactionDetails &&
      transactionDetails.from &&
      transactionDetails.network
    ) {
      dispatch(getMaxFeeAndMaxPriorityFeePerGas()).then(
        ({ maxFeePerGas, maxPriorityFeePerGas }) => {
          if (estimatedFeesPerGas) {
            if (estimatedFeesPerGas.regular) {
              estimatedFeesPerGas.regular.maxFeePerGas = maxFeePerGas
              estimatedFeesPerGas.regular.maxPriorityFeePerGas =
                maxPriorityFeePerGas
            }
            estimatedFeesPerGas.maxFeePerGas = maxFeePerGas
            estimatedFeesPerGas.maxPriorityFeePerGas = maxPriorityFeePerGas
          }
        }
      )
    }
  }, [])

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
        <FeeSettingsButton onClick={() => setNetworkSettingsModalOpen(true)} />
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
      <style jsx>
        {`
          .detail_item {
            width: 100%;
            color: var(--green-40);
            font-size: 14px;
            line-height: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
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
        `}
      </style>
    </div>
  )
}
