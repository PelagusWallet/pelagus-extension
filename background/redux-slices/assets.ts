import { Contract, getAddress, toBigInt } from "quais"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
import { createSelector, createSlice } from "@reduxjs/toolkit"
import { QRC20_INTERFACE } from "../contracts/qrc-20"

import {
  AnyAsset,
  AnyAssetAmount,
  AnyAssetMetadata,
  flipPricePoint,
  isFungibleAsset,
  isSmartContractFungibleAsset,
  PricePoint,
  SmartContractFungibleAsset,
} from "../assets"
import { AddressOnNetwork } from "../accounts"
import { createBackgroundAsyncThunk } from "./utils"
import { isBuiltInNetworkBaseAsset, isSameAsset } from "./utils/asset-utils"
import { getProvider } from "./utils/contract-utils"
import { sameNetwork } from "../networks"
import { convertFixedPoint } from "../lib/fixed-point"
import { removeAssetReferences, updateAssetReferences } from "./accounts"
import type { RootState } from "."
import { emitter as transactionConstructionSliceEmitter } from "./transaction-construction"
import { AccountSigner } from "../services/signing"
import { setSnackbarMessage } from "./ui"
import { NetworkInterfaceGA } from "../constants/networks/networkTypes"

export type AssetWithRecentPrices<T extends AnyAsset = AnyAsset> = T & {
  recentPrices: {
    [assetSymbol: string]: PricePoint
  }
}

export type SingleAssetState = AssetWithRecentPrices

export type AssetsState = SingleAssetState[]

export const initialState = [] as AssetsState

const assetsSlice = createSlice({
  name: "assets",
  initialState,
  reducers: {
    assetsLoaded: (
      immerState,
      { payload: newAssets }: { payload: AnyAsset[] }
    ) => {
      const mappedAssets: { [sym: string]: SingleAssetState[] } = {}
      // bin existing known assets
      immerState.forEach((asset) => {
        if (mappedAssets[asset.symbol] === undefined) {
          mappedAssets[asset.symbol] = []
        }
        // if an asset is already in state, assume unique checks have been done
        // no need to check network, contract address, etc
        mappedAssets[asset.symbol].push(asset)
      })
      // merge in new assets
      newAssets.forEach((newAsset) => {
        if (mappedAssets[newAsset.symbol] === undefined) {
          mappedAssets[newAsset.symbol] = [
            {
              ...newAsset,
              recentPrices: {},
            },
          ]
        } else {
          const duplicateIndexes = mappedAssets[newAsset.symbol].reduce<
            number[]
          >((acc, existingAsset, id) => {
            if (isSameAsset(newAsset, existingAsset)) {
              acc.push(id)
            }
            return acc
          }, [])

          // if there aren't duplicates, add the asset
          if (duplicateIndexes.length === 0) {
            mappedAssets[newAsset.symbol].push({
              ...newAsset,
              recentPrices: {},
            })
          } else {
            // TODO if there are duplicates... when should we replace assets?
            duplicateIndexes.forEach((id) => {
              // Update only the metadata for the duplicate
              mappedAssets[newAsset.symbol][id] = {
                ...mappedAssets[newAsset.symbol][id],
                metadata: newAsset.metadata,
              }
            })
          }
        }
      })

      return Object.values(mappedAssets).flat()
    },
    removeAsset: (
      immerState,
      { payload: removedAsset }: { payload: AnyAsset }
    ) => {
      return immerState.filter((asset) => !isSameAsset(asset, removedAsset))
    },
  },
})

export const { assetsLoaded, removeAsset } = assetsSlice.actions

export default assetsSlice.reducer

const selectAssetsState = (state: AssetsState) => state
const selectAsset = (_: AssetsState, asset: AnyAsset) => asset

const selectPairedAssetSymbol = (
  _: AssetsState,
  _2: AnyAsset,
  pairedAssetSymbol: string
) => pairedAssetSymbol

export const updateAssetMetadata = createBackgroundAsyncThunk(
  "assets/updateAssetMetadata",
  async (
    {
      asset,
      metadata,
    }: {
      asset: SmartContractFungibleAsset
      metadata: AnyAssetMetadata
    },
    { extra: { main } }
  ) => {
    await main.updateAssetMetadata(asset, metadata)
  }
)

export const refreshAsset = createBackgroundAsyncThunk(
  "assets/refreshAsset",
  async (
    {
      asset,
    }: {
      asset: SmartContractFungibleAsset
    },
    { dispatch }
  ) => {
    await dispatch(assetsLoaded([asset]))
    await dispatch(updateAssetReferences(asset))
  }
)

export const hideAsset = createBackgroundAsyncThunk(
  "assets/hideAsset",
  async (
    {
      asset,
    }: {
      asset: SmartContractFungibleAsset
    },
    { extra: { main } }
  ) => {
    await main.hideAsset(asset)
  }
)

/**
 * Removes the asset from the user interface.
 * The token should be removed from the assets list and all references associated with it.
 */
export const removeAssetData = createBackgroundAsyncThunk(
  "assets/removeAssetData",
  async (
    {
      asset,
    }: {
      asset: SmartContractFungibleAsset
    },
    { dispatch }
  ) => {
    dispatch(removeAsset(asset))
    dispatch(removeAssetReferences(asset))
  }
)

export const getMaxFeeAndMaxPriorityFeePerGas = createBackgroundAsyncThunk(
  "assets/getAccountGasPrice",
  async (
    _,
    { dispatch }
  ): Promise<{
    maxFeePerGas: BigInt
    maxPriorityFeePerGas: BigInt
  }> => {
    const { jsonRpc: provider } =
      globalThis.main.chainService.getCurrentProvider()
    const feeData = await provider.getFeeData()
    if (
      !feeData.gasPrice ||
      !feeData.maxFeePerGas ||
      !feeData.maxPriorityFeePerGas
    ) {
      dispatch(
        setSnackbarMessage("Failed to get gas price, please enter manually")
      )
    }
    return {
      maxFeePerGas: toBigInt(feeData.maxFeePerGas ?? 0),
      maxPriorityFeePerGas: toBigInt(feeData.maxPriorityFeePerGas ?? 0),
    }
  }
)

/**
 * Executes an asset transfer between two addresses, for a set amount. Supports
 * an optional fixed gas limit.
 *
 * If the from address is not a writeable address in the wallet, this signature
 * will not be possible.
 */
export const sendAsset = createBackgroundAsyncThunk(
  "assets/sendAsset",
  async (transferDetails: {
    fromAddressNetwork: AddressOnNetwork
    toAddressNetwork: AddressOnNetwork
    assetAmount: AnyAssetAmount
    gasLimit?: bigint
    maxPriorityFeePerGas?: bigint & BigInt
    maxFeePerGas?: bigint & BigInt
    accountSigner: AccountSigner
  }): Promise<{ success: boolean; errorMessage?: string }> => {
    const {
      fromAddressNetwork: { address: fromAddress, network: fromNetwork },
      toAddressNetwork: { address: toAddress, network: toNetwork },
      assetAmount,
      gasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas,
      accountSigner,
    } = transferDetails

    try {
      if (!sameNetwork(fromNetwork, toNetwork)) {
        return {
          success: false,
          errorMessage: "Only same-network transfers are supported for now.",
        }
      }

      let transactionData = "0x"
      let transactionValue = assetAmount.amount
      let toAddressData = toAddress

      if (isSmartContractFungibleAsset(assetAmount.asset)) {
        const provider = getProvider()
        const signer = await provider.getSigner(fromAddress)

        const tokenContract = new Contract(
          assetAmount.asset.contractAddress,
          QRC20_INTERFACE,
          signer
        )

        const transactionDetails =
          await tokenContract.transfer.populateTransaction(
            toAddress,
            assetAmount.amount
          )

        toAddressData = transactionDetails.to
        transactionData = transactionDetails.data
        transactionValue = 0n
      }

      const request: QuaiTransactionRequest = {
        to: getAddress(toAddressData),
        from: fromAddress,
        // TODO
        chainId: "9000",
        gasLimit,
        maxPriorityFeePerGas,
        maxFeePerGas,
        data: transactionData,
        value: transactionValue,
      }
      await transactionConstructionSliceEmitter.emit(
        "signAndSendQuaiTransaction",
        {
          request,
          accountSigner,
        }
      )

      return { success: true }
    } catch (error) {
      return {
        success: false,
        errorMessage: `Transfer failed: ${error}`,
      }
    }
  }
)

/**
 * Selects a particular asset price point given the asset symbol and the paired
 * asset symbol used to price it.
 *
 * For example, calling `selectAssetPricePoint(state.assets, ETH, "USD")`
 * will return the ETH-USD price point, if it exists. Note that this selector
 * guarantees that the returned price point will have the pair in the specified
 * order, so even if the store price point has amounts in the order [USD, ETH],
 * the selector will return them in the order [ETH, USD].
 */
export const selectAssetPricePoint = createSelector(
  [selectAssetsState, selectAsset, selectPairedAssetSymbol],
  (assets, assetToFind, pairedAssetSymbol) => {
    const hasRecentPriceData = (asset: SingleAssetState): boolean =>
      pairedAssetSymbol in asset.recentPrices &&
      asset.recentPrices[pairedAssetSymbol].pair.some(
        ({ symbol }) => symbol === assetToFind.symbol
      )

    let pricedAsset: SingleAssetState | undefined

    /* If we're looking for a smart contract, try to find an exact price point */
    if (isSmartContractFungibleAsset(assetToFind)) {
      pricedAsset = assets.find(
        (asset): asset is AssetWithRecentPrices<SmartContractFungibleAsset> =>
          isSmartContractFungibleAsset(asset) &&
          asset.contractAddress === assetToFind.contractAddress &&
          asset.homeNetwork.chainID === assetToFind.homeNetwork.chainID &&
          hasRecentPriceData(asset)
      )

      /* Don't do anything else if this is an unverified asset and there's no exact match */
      if (
        (assetToFind.metadata?.tokenLists?.length ?? 0) < 1 &&
        !isBuiltInNetworkBaseAsset(assetToFind, assetToFind.homeNetwork)
      )
        return undefined
    }

    /* Otherwise, find a best-effort match by looking for assets with the same symbol  */
    if (!pricedAsset) {
      pricedAsset = assets.find(
        (asset) =>
          asset.symbol === assetToFind.symbol && hasRecentPriceData(asset)
      )
    }

    if (pricedAsset) {
      let pricePoint = pricedAsset.recentPrices[pairedAssetSymbol]

      // Flip it if the price point looks like USD-ETH
      if (pricePoint.pair[0].symbol !== assetToFind.symbol) {
        pricePoint = flipPricePoint(pricePoint)
      }

      const assetDecimals = isFungibleAsset(assetToFind)
        ? assetToFind.decimals
        : 0
      const pricePointAssetDecimals = isFungibleAsset(pricePoint.pair[0])
        ? pricePoint.pair[0].decimals
        : 0

      if (assetDecimals !== pricePointAssetDecimals) {
        const { amounts } = pricePoint
        pricePoint = {
          ...pricePoint,
          amounts: [
            convertFixedPoint(
              amounts[0],
              pricePointAssetDecimals,
              assetDecimals
            ),
            amounts[1],
          ],
        }
      }

      return pricePoint
    }

    return undefined
  }
)

export const importCustomToken = createBackgroundAsyncThunk(
  "assets/importCustomToken",
  async (
    {
      asset,
    }: {
      asset: SmartContractFungibleAsset
    },
    { extra: { main } }
  ) => {
    return { success: await main.importCustomToken(asset) }
  }
)

export const checkTokenContractDetails = createBackgroundAsyncThunk(
  "assets/checkTokenContractDetails",
  async (
    {
      contractAddress,
      network,
    }: { contractAddress: string; network: NetworkInterfaceGA },
    { getState, extra: { main } }
  ) => {
    const state = getState() as RootState
    const currentAccount = state.ui.selectedAccount

    try {
      return await main.queryCustomTokenDetails(contractAddress, {
        ...currentAccount,
        network,
      })
    } catch (error) {
      console.log(error)
      return null
    }
  }
)
