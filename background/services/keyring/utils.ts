import { FORK } from "../../constants"
import { SignedTransaction } from "../../networks"
import { FeatureFlags, isEnabled } from "../../features"

export const parseAndValidateSignedTransaction = (
  tx: any,
  network: any
): SignedTransaction => {
  if (!tx.hash || !tx.from || !tx.r || !tx.s || typeof tx.v === "undefined") {
    throw new Error("Transaction doesn't appear to have been signed.")
  }

  const {
    to,
    gasPrice,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    externalGasLimit,
    externalGasPrice,
    externalGasTip,
    hash,
    from,
    nonce,
    data,
    value,
    type,
    r,
    s,
    v,
  } = tx

  const baseSignedTx = {
    hash,
    from,
    to,
    nonce,
    input: data,
    value: value.toBigInt(),
    type: type as 0,
    gasLimit: gasLimit.toBigInt(),
    r,
    s,
    v,
    blockHash: null,
    blockHeight: null,
    asset: network.baseAsset,
    network: isEnabled(FeatureFlags.USE_MAINNET_FORK) ? FORK : network,
  }

  const signedTx: SignedTransaction =
    typeof maxPriorityFeePerGas === "undefined" ||
    typeof maxFeePerGas === "undefined"
      ? {
          ...baseSignedTx,
          gasPrice: gasPrice?.toBigInt() ?? null,
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
        }
      : {
          ...baseSignedTx,
          gasPrice: null,
          maxFeePerGas: maxFeePerGas.toBigInt(),
          maxPriorityFeePerGas: maxPriorityFeePerGas.toBigInt(),
          externalGasLimit: externalGasLimit?.toBigInt(),
          externalGasPrice: externalGasPrice?.toBigInt(),
          externalGasTip: externalGasTip?.toBigInt(),
          type: type as 0 | 2 | 1 | 100 | null,
        }

  return signedTx
}
