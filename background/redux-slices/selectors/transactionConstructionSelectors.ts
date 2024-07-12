import { createSelector } from "@reduxjs/toolkit"
import { toBigInt } from "quais"
import { PricePoint } from "../../assets"
import { selectCurrentNetwork } from "."
import { NetworksState } from "../networks"
import {
  TransactionConstruction,
  NetworkFeeSettings,
} from "../transaction-construction"
import { getAssetsState } from "./accountsSelectors"
import { selectMainCurrencySymbol } from "./uiSelectors"
import { selectAssetPricePoint } from "../assets"

export const selectTransactionNetwork = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.transactionRequest?.network, // TODO-MIGRATION
  (network) => network
)

export const selectDefaultNetworkFeeSettings = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction,
  (state: { networks: NetworksState }) => state.networks,
  selectCurrentNetwork,
  selectTransactionNetwork,
  (
    transactionConstruction,
    networks,
    selectedNetwork,
    transactionNetwork
  ): NetworkFeeSettings => {
    const currentNetwork = transactionNetwork || selectedNetwork
    const selectedFeesPerGas =
      transactionConstruction.estimatedFeesPerGas?.[currentNetwork.chainID]?.[
        transactionConstruction.feeTypeSelected
      ] ?? transactionConstruction.customFeesPerGas
    return {
      feeType: transactionConstruction.feeTypeSelected,
      gasLimit: undefined,
      suggestedGasLimit: toBigInt(
        transactionConstruction.transactionRequest?.gasLimit ?? 0
      ),
      values: {
        maxFeePerGas: selectedFeesPerGas?.maxFeePerGas ?? 0n,
        maxPriorityFeePerGas: selectedFeesPerGas?.maxPriorityFeePerGas ?? 0n,
        gasPrice: selectedFeesPerGas?.price ?? 1000000000n,
        baseFeePerGas:
          networks.blockInfo[currentNetwork.chainID]?.baseFeePerGas ??
          undefined,
      },
    }
  }
)

export const selectEstimatedFeesPerGas = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.estimatedFeesPerGas,
  selectTransactionNetwork,
  selectCurrentNetwork,
  (gasData, transactionNetwork, selectedNetwork) =>
    transactionNetwork
      ? gasData[transactionNetwork.chainID]
      : gasData[selectedNetwork.chainID]
)

export const selectBaseAsset = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.transactionRequest?.network.baseAsset, // TODO-MIGRATION
  (baseAsset) => baseAsset
)

export const selectTransactionMainCurrencyPricePoint = createSelector(
  selectBaseAsset,
  getAssetsState,
  (state) => selectMainCurrencySymbol(state),
  selectCurrentNetwork,
  (
    baseAsset,
    assets,
    mainCurrencySymbol,
    currentNetwork
  ): PricePoint | undefined => {
    return selectAssetPricePoint(
      assets,
      baseAsset ?? currentNetwork.baseAsset,
      mainCurrencySymbol
    )
  }
)

export const selectTransactionData = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.transactionRequest,
  (transactionRequestData) => transactionRequestData
)

export const selectIsTransactionPendingSignature = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.status,
  (status) => status === "loaded" || status === "pending"
)

export const selectIsTransactionLoaded = createSelector(
  (state: { transactionConstruction: TransactionConstruction }) =>
    state.transactionConstruction.status,
  (status) => status === "loaded"
)

export const selectHasInsufficientFunds = createSelector(
  selectTransactionData,
  (transactionDetails) =>
    !!transactionDetails?.annotation?.warnings?.includes("insufficient-funds")
)
