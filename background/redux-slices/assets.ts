import { createSelector, createSlice } from "@reduxjs/toolkit"
import { BigNumber, ethers } from "ethers"
import { JsonRpcProvider } from "@quais/providers"
import { keccak256 } from "@quais/keccak256";
import { UnsignedTransaction } from "@quais/transactions";
import { quais } from "quais"
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
import { findClosestAssetIndex } from "../lib/asset-similarity"
import { createBackgroundAsyncThunk } from "./utils"
import { isBuiltInNetworkBaseAsset, isSameAsset } from "./utils/asset-utils"
import { getProvider } from "./utils/contract-utils"
import { EIP1559TransactionRequest, EVMNetwork, KnownTxTypes, SignedTransaction, TransactionRequestWithNonce, sameNetwork } from "../networks"
import { ERC20_INTERFACE } from "../lib/erc20"
import logger from "../lib/logger"
import { CHAIN_ID_TO_RPC_URLS, FIAT_CURRENCIES_SYMBOL, NUM_REGIONS_IN_PRIME, NUM_ZONES_IN_REGION, QUAI, QUAI_NETWORK, getShardFromAddress } from "../constants"
import { convertFixedPoint } from "../lib/fixed-point"
import { removeAssetReferences, updateAssetReferences } from "./accounts"
import { NormalizedEVMAddress } from "../types"
import type { RootState } from "."
import { hexlify, stripZeros, toUtf8Bytes, accessListify, hexConcat, RLP } from "quais/lib/utils"
import { emitter as transactionConstructionSliceEmitter } from "./transaction-construction"
import { AccountSigner } from "../services/signing"
import { normalizeEVMAddress } from "../lib/utils";
import { setSnackbarMessage } from "./ui";


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
    newPricePoints: (
      immerState,
      { payload: pricePoints }: { payload: PricePoint[] }
    ) => {
      pricePoints.forEach((pricePoint) => {
        const fiatCurrency = pricePoint.pair.find((asset) =>
          FIAT_CURRENCIES_SYMBOL.includes(asset.symbol)
        )
        const [pricedAsset] = pricePoint.pair.filter(
          (asset) => asset !== fiatCurrency
        )
        if (fiatCurrency && pricedAsset) {
          const index = findClosestAssetIndex(pricedAsset, immerState)
          if (typeof index !== "undefined") {
            immerState[index].recentPrices[fiatCurrency.symbol] = pricePoint
          }
        }
      })
    },
    removeAsset: (
      immerState,
      { payload: removedAsset }: { payload: AnyAsset }
    ) => {
      return immerState.filter((asset) => !isSameAsset(asset, removedAsset))
    },
  },
})

export const { assetsLoaded, newPricePoints, removeAsset } = assetsSlice.actions

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
    // Update assets slice
    await dispatch(assetsLoaded([asset]))
    // Update accounts slice cached data about this asset
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
    await dispatch(removeAsset(asset))
    await dispatch(removeAssetReferences(asset))
  }
)

export const getAccountNonceAndGasPrice = createBackgroundAsyncThunk(
  "assets/getAccountNonceAndGasPrice",
  async (details: {
    network: EVMNetwork,
    address: string,
  }
  ): Promise<{ nonce: number; maxFeePerGas: string, maxPriorityFeePerGas: string }> => {
    const prevShard = globalThis.main.GetShard()
    globalThis.main.SetShard(getShardFromAddress(details.address))
    const provider = globalThis.main.chainService.providerForNetworkOrThrow(details.network)
    const normalizedAddress = normalizeEVMAddress(details.address)
    const nonce = await provider.getTransactionCount(normalizedAddress)
    const feeData = await provider.getFeeData()
    globalThis.main.SetShard(prevShard)
    return { nonce, maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : '0', maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : '0' }
  }
)


/**
 * Executes an asset transfer between two addresses, for a set amount. Supports
 * an optional fixed gas limit.
 *
 * If the from address is not a writeable address in the wallet, this signature
 * will not be possible.
 */
export const transferAsset = createBackgroundAsyncThunk(
  "assets/transferAsset",
  async (transferDetails: {
    fromAddressNetwork: AddressOnNetwork
    toAddressNetwork: AddressOnNetwork
    assetAmount: AnyAssetAmount
    gasLimit?: bigint
    nonce?: number
    maxPriorityFeePerGas?: bigint
    maxFeePerGas?: bigint
    accountSigner: AccountSigner
  }) => {
    var { 
      fromAddressNetwork: { address: fromAddress, network: fromNetwork },
      toAddressNetwork: { address: toAddress, network: toNetwork },
      assetAmount,
      gasLimit,
      nonce,
      maxPriorityFeePerGas,
      maxFeePerGas,
      accountSigner,
    } = transferDetails;

    if (!sameNetwork(fromNetwork, toNetwork)) {
      throw new Error("Only same-network transfers are supported for now.")
    }

    if(fromNetwork.isQuai) {
      let data = ""
      const provider = globalThis.main.chainService.providerForNetworkOrThrow(fromNetwork)
      if (nonce == undefined) {
        nonce = await provider.getTransactionCount(fromAddress)
      }
      if (isSmartContractFungibleAsset(assetAmount.asset)) {
        logger.debug(
          `Sending ${assetAmount.amount} ${assetAmount.asset.symbol} from ` +
            `${fromAddress} to ${toAddress} as an ERC20 transfer.`
        )
        const token = new quais.Contract(
          assetAmount.asset.contractAddress,
          ERC20_INTERFACE,
          provider
        )
        let fromShard = getShardFromAddress(fromAddress)
        let toShard = getShardFromAddress(toAddress)
        if(fromShard != toShard) { // ERC20x cross-chain transfer
          let minerTip = BigInt(1000000000) * BigInt(calcEtxFeeMultiplier(fromShard, toShard))
          let baseFee = BigInt(2000000000) * BigInt(calcEtxFeeMultiplier(fromShard, toShard))
          let gasLimit = BigInt(100000)
          let amount = (baseFee + minerTip) * gasLimit
          let transactionDetails = await token.populateTransaction.crossChainTransfer(toAddress, assetAmount.amount, gasLimit, minerTip, baseFee)
          toAddress = transactionDetails.to? transactionDetails.to : ""
          data = transactionDetails.data? transactionDetails.data : ""
          assetAmount = {
            asset: QUAI,
            amount: amount,
          }
        } else {
          let transactionDetails = await token.populateTransaction.transfer(toAddress, assetAmount.amount)
          toAddress = transactionDetails.to? transactionDetails.to : ""
          data = transactionDetails.data? transactionDetails.data : ""
          assetAmount = {
            asset: QUAI,
            amount: BigInt(0),
          }
        }
        
      }
      let tx = genQuaiRawTransaction(fromNetwork, fromAddress, toAddress, assetAmount, nonce, fromNetwork.chainID, data, gasLimit??BigInt(200000), maxFeePerGas??BigInt(2000000000), maxPriorityFeePerGas??BigInt(1000000000))
      signData({transaction: tx, accountSigner: accountSigner})
      return
    }

    const provider = getProvider()
    const signer = provider.getSigner()
    console.log(await signer.getAddress())

    if (isBuiltInNetworkBaseAsset(assetAmount.asset, fromNetwork)) {
      logger.debug(
        `Sending ${assetAmount.amount} ${assetAmount.asset.symbol} from ` +
          `${fromAddress} to ${toAddress} as a base asset transfer.`
      )
      await signer.sendTransaction({
        from: fromAddress,
        to: toAddress,
        value: assetAmount.amount,
        gasLimit,
        nonce,
      })
    } else if (isSmartContractFungibleAsset(assetAmount.asset)) {
      logger.debug(
        `Sending ${assetAmount.amount} ${assetAmount.asset.symbol} from ` +
          `${fromAddress} to ${toAddress} as an ERC20 transfer.`
      )
      const token = new ethers.Contract(
        assetAmount.asset.contractAddress,
        ERC20_INTERFACE,
        signer
      )

      const transactionDetails = await token.populateTransaction.transfer(
        toAddress,
        assetAmount.amount
      )

      await signer.sendUncheckedTransaction({
        ...transactionDetails,
        gasLimit: gasLimit ?? transactionDetails.gasLimit,
        nonce,
      })
    } else {
      throw new Error(
        "Only base and fungible smart contract asset transfers are supported for now."
      )
    }
  }
)

function genQuaiRawTransaction (network: EVMNetwork, fromAddress: string, toAddress: string, assetAmount: AnyAssetAmount, nonce: number, chainId: string, data: string, gasLimit: bigint, maxFeePerGas: bigint, maxPriorityFeePerGas: bigint): EIP1559TransactionRequest {
   
  let isExternal = false
  let type = 0
  let fromShard = getShardFromAddress(fromAddress)
  let toShard = getShardFromAddress(toAddress)

  if (fromShard != toShard) {
    isExternal = true
  }
  
    if (isExternal) { // is external this time    
      type = 2
    } else {
      type = 0
    }

    const tx: EIP1559TransactionRequest = {
      to: toAddress,
      from: fromAddress,
      value: assetAmount.amount,
      nonce: nonce,
      gasLimit: gasLimit??BigInt(200000),
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFeePerGas,
      type: type as KnownTxTypes,
      chainID: chainId,
      input: data,
      network: network,
    }

    if (isExternal) { // is external this time
      tx.externalGasLimit = BigInt(100000)
      tx.externalGasPrice = tx.maxFeePerGas * BigInt(calcEtxFeeMultiplier(fromShard, toShard))
      tx.externalGasTip = tx.maxPriorityFeePerGas * BigInt(calcEtxFeeMultiplier(fromShard, toShard))
    }
    return tx
}

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
      ) {
        return undefined
      }
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

    // If no matching priced asset was found, return undefined.
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
    }: { contractAddress: NormalizedEVMAddress; network: EVMNetwork },
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
      // FIXME: Rejected thunks return undefined instead of throwing
      console.log(error)
      return null
    }
  }
)

transactionConstructionSliceEmitter.on("signedTransactionResult", async (tx) => { 
  console.log("transaction signed", tx)
  const provider = globalThis.main.chainService.providerForNetworkOrThrow(tx.network)
  try {
    let res = await provider.sendTransaction(serializeSigned(tx))
    console.log(res)
    globalThis.main.chainService.saveTransaction(tx, "local")
  } catch (error: any) {
    if(error.toString().includes("insufficient funds")) {
      globalThis.main.store.dispatch(setSnackbarMessage("Insufficient funds for gas * price + value"))
    }
    console.log(error)
  }
  
})

const signData = async function (
  {
    transaction,
    accountSigner,
  }: {
    transaction: EIP1559TransactionRequest
    accountSigner: AccountSigner
  },
) {
   transactionConstructionSliceEmitter.emit("requestSignature", {
    request: transaction, 
    accountSigner: accountSigner,
    })
}

function serializeSigned(transaction: SignedTransaction): string {
  // If there is an explicit gasPrice, make sure it matches the
  // EIP-1559 fees; otherwise they may not understand what they
  // think they are setting in terms of fee.
  if (transaction.gasPrice != null) {
      const gasPrice = BigNumber.from(transaction.gasPrice);
      const maxFeePerGas = BigNumber.from(transaction.maxFeePerGas || 0);
      if (!gasPrice.eq(maxFeePerGas)) {
          logger.error("mismatch EIP-1559 gasPrice != maxFeePerGas", "tx", {
              gasPrice, maxFeePerGas
          });
          throw new Error("mismatch EIP-1559 gasPrice != maxFeePerGas");
      }
  }

  const fields: any = [
      formatNumber(transaction.network.chainID || 0, "chainId"),
      formatNumber(transaction.nonce || 0, "nonce"),
      formatNumber(transaction.maxPriorityFeePerGas || 0, "maxPriorityFeePerGas"),
      formatNumber(transaction.maxFeePerGas || 0, "maxFeePerGas"),
      formatNumber(transaction.gasLimit || 0, "gasLimit"),
      (transaction.to), // presuming it's valid as it's already signed
      formatNumber(transaction.value || 0, "value"),
      (transaction.input || "0x"),
      (formatAccessList([]))
  ];
      if (transaction.type == 2) {
        fields.push(formatNumber(transaction.externalGasLimit || 0, "externalGasLimit"))
        fields.push(formatNumber(transaction.externalGasPrice || 0, "externalGasPrice"))
        fields.push(formatNumber(transaction.externalGasTip || 0, "externalGasTip"))
        fields.push(/*transaction.externalData ||*/ "0x")
        fields.push(formatAccessList(/*transaction.externalAccessList ||*/ []))
        fields.push(formatNumber(transaction.v, "recoveryParam"));
        fields.push(stripZeros(transaction.r));
        fields.push(stripZeros(transaction.s));
        return hexConcat([ "0x02", RLP.encode(fields)]);
      } else {
        fields.push(formatNumber(transaction.v, "recoveryParam"));
        fields.push(stripZeros(transaction.r));
        fields.push(stripZeros(transaction.s));
        return hexConcat([ "0x00", RLP.encode(fields)]);
      }
}

function formatNumber(value: any, name: string): Uint8Array {
  const result = stripZeros(BigNumber.from(value).toHexString());
  if (result.length > 32) {
      logger.error("invalid length for " + name, ("transaction:" + name), value);
  }
  return result;
}

function formatAccessList(value: any): Array<[ string, Array<string> ]> {
  return accessListify(value).map((set) => [ set.address, set.storageKeys ]);
}

// Emitted ETXs must include some multiple of BaseFee as miner tip, to
// encourage processing at the destination.
export function calcEtxFeeMultiplier(fromShard: string, toShard: string) {
	let multiplier = NUM_ZONES_IN_REGION
  if(fromShard == undefined || toShard == undefined || fromShard == toShard) {
    console.error("invalid shards in calcEtxFeeMultiplier: " + fromShard + " " + toShard)
    return 0 // will cause an error
  }
	if (fromShard.includes("cyprus") && toShard.includes("cyprus") || fromShard.includes("paxos") && toShard.includes("paxos") || fromShard.includes("hydra") && toShard.includes("hydra")) {
    // same region
		multiplier = NUM_ZONES_IN_REGION
	} else {
    multiplier = NUM_ZONES_IN_REGION * NUM_REGIONS_IN_PRIME
  }
	return multiplier
}
