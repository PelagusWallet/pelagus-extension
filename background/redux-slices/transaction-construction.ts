import { createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { QuaiTransactionLike } from "quais/lib/commonjs/transaction"
import { QuaiTransaction } from "quais"
import { QuaiTransactionResponse } from "quais/lib/commonjs/providers"
import { EXPRESS, INSTANT, MAX_FEE_MULTIPLIER, REGULAR } from "../constants"
import { BlockEstimate, BlockPrices } from "../networks"
import { createBackgroundAsyncThunk } from "./utils"
import { SignOperation } from "./signing"
import { NetworkInterface } from "../constants/networks/networkTypes"
import { QuaiTransactionRequestWithAnnotation } from "../services/transactions/types"

export const enum TransactionConstructionStatus {
  Idle = "idle",
  Pending = "pending",
  Loaded = "loaded",
  Signed = "signed",
}

export type NetworkFeeSettings = {
  feeType: NetworkFeeTypeChosen
  gasLimit: bigint | undefined
  suggestedGasLimit: bigint | undefined
  values: {
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    baseFeePerGas?: bigint
    gasPrice?: bigint
  }
}

export enum NetworkFeeTypeChosen {
  Auto = "auto",
  Regular = "regular",
  Express = "express",
  Instant = "instant",
  Custom = "custom",
}
export type TransactionConstruction = {
  status: TransactionConstructionStatus
  transactionRequest?: QuaiTransactionRequestWithAnnotation
  signedTransaction?: QuaiTransactionLike // TODO-MIGRATION
  signedQuaiTransactionResponse?: QuaiTransactionResponse
  broadcastOnSign?: boolean
  transactionLikelyFails: boolean
  estimatedFeesPerGas: { [chainID: string]: EstimatedFeesPerGas | undefined }
  customFeesPerGas?: EstimatedFeesPerGas["custom"]
  feeTypeSelected: NetworkFeeTypeChosen
}

export type EstimatedFeesPerGas = {
  baseFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  maxFeePerGas?: bigint
  auto?: BlockEstimate
  instant?: BlockEstimate
  express?: BlockEstimate
  regular?: BlockEstimate
  custom?: BlockEstimate
}

const defaultCustomGas = {
  maxFeePerGas: 0n,
  maxPriorityFeePerGas: 0n,
  confidence: 0,
}

export const initialState: TransactionConstruction = {
  status: TransactionConstructionStatus.Idle,
  feeTypeSelected: NetworkFeeTypeChosen.Auto,
  estimatedFeesPerGas: {},
  transactionLikelyFails: false,
  customFeesPerGas: defaultCustomGas,
}

export type Events = {
  updateTransaction: QuaiTransactionRequestWithAnnotation

  requestSendTransaction: SignOperation<QuaiTransactionRequestWithAnnotation>
  sendTransactionRejected: never
  broadcastSignedTransaction: QuaiTransaction
}

export type GasOption = {
  confidence: string
  estimatedSpeed: string
  type: NetworkFeeTypeChosen
  estimatedGwei: string
  maxPriorityGwei: string
  maxGwei: string
  dollarValue: string
  gasPrice?: string
  estimatedFeePerGas: bigint // wei
  baseMaxFeePerGas: bigint // wei
  baseMaxGwei: string
  maxFeePerGas: bigint // wei
  maxPriorityFeePerGas: bigint // wei
}

export const emitter = new Emittery<Events>()

const makeBlockEstimate = (
  type: number,
  estimatedFeesPerGas: BlockPrices
): BlockEstimate => {
  let maxFeePerGas = estimatedFeesPerGas.estimatedPrices.find(
    (el) => el.confidence === type
  )?.maxFeePerGas

  if (typeof maxFeePerGas === "undefined") {
    // Fallback
    maxFeePerGas = estimatedFeesPerGas.baseFeePerGas
  }

  // Exaggerate differences between options
  maxFeePerGas = (maxFeePerGas * MAX_FEE_MULTIPLIER[type]) / 10n

  return {
    maxFeePerGas,
    confidence: type,
    maxPriorityFeePerGas:
      estimatedFeesPerGas.estimatedPrices.find((el) => el.confidence === type)
        ?.maxPriorityFeePerGas ?? 0n,
    price:
      estimatedFeesPerGas.estimatedPrices.find((el) => el.confidence === type)
        ?.price ?? 0n,
  }
}

// Async thunk to pass transaction options from the store to the background via an event
export const updateTransactionData = createBackgroundAsyncThunk(
  "transaction-construction/update-transaction",
  async (payload: QuaiTransactionRequestWithAnnotation) => {
    await emitter.emit("updateTransaction", payload)
  }
)

export const sendTransaction = createBackgroundAsyncThunk(
  "transaction-construction/send",
  async (
    { accountSigner }: SignOperation<QuaiTransactionRequestWithAnnotation>,
    { getState }
  ) => {
    const { transactionConstruction } = getState() as {
      transactionConstruction: TransactionConstruction
    }

    if (!transactionConstruction?.transactionRequest) {
      throw new Error("transactionRequest was not found")
    }

    const { to, data, from, gasLimit, value, chainId } =
      transactionConstruction.transactionRequest

    if (!chainId) throw new Error("chainId was not found")

    const selectedFeesPerGas =
      transactionConstruction.estimatedFeesPerGas?.[chainId.toString()]?.[
        transactionConstruction.feeTypeSelected
      ] ?? transactionConstruction.customFeesPerGas

    const request = {
      to,
      from,
      gasLimit,
      maxPriorityFeePerGas: selectedFeesPerGas?.maxPriorityFeePerGas,
      maxFeePerGas: selectedFeesPerGas?.maxFeePerGas,
      data,
      value,
      chainId,
    } as QuaiTransactionRequestWithAnnotation

    const autoFeeRequest = {
      to,
      from,
      data,
      value,
      chainId,
    } as QuaiTransactionRequestWithAnnotation

    await emitter.emit("requestSendTransaction", {
      request:
        transactionConstruction.feeTypeSelected === NetworkFeeTypeChosen.Auto
          ? autoFeeRequest
          : request,
      accountSigner,
    })
  }
)

const transactionSlice = createSlice({
  name: "transaction-construction",
  initialState,
  reducers: {
    transactionRequest: (
      state,
      {
        payload: { transactionRequest, transactionLikelyFails },
      }: {
        payload: {
          transactionRequest: QuaiTransactionRequestWithAnnotation
          transactionLikelyFails: boolean
        }
      }
    ) => {
      return {
        ...state,
        status: TransactionConstructionStatus.Loaded,
        signedTransaction: undefined,
        transactionRequest: {
          ...transactionRequest,
        },
        transactionLikelyFails,
      }
    },
    clearTransactionState: (
      state,
      { payload }: { payload: TransactionConstructionStatus }
    ) => ({
      estimatedFeesPerGas: state.estimatedFeesPerGas,
      status: payload,
      feeTypeSelected: state.feeTypeSelected ?? NetworkFeeTypeChosen.Auto,
      broadcastOnSign: false,
      transactionLikelyFails: false,
      signedTransaction: undefined,
      customFeesPerGas: state.customFeesPerGas,
    }),
    setFeeType: (
      immerState,
      { payload }: { payload: NetworkFeeTypeChosen }
    ) => {
      immerState.feeTypeSelected = payload
    },
    signed: (state, { payload }: { payload: string }) => ({
      ...state,
      status: TransactionConstructionStatus.Signed,
      signedTransaction: JSON.parse(payload),
    }),
    setQuaiTransactionResponse: (state, { payload }: { payload: string }) => ({
      ...state,
      status: TransactionConstructionStatus.Signed,
      signedQuaiTransactionResponse: JSON.parse(payload),
    }),
    broadcastOnSign: (state, { payload }: { payload: boolean }) => ({
      ...state,
      broadcastOnSign: payload,
    }),
    transactionLikelyFails: (state) => ({
      ...state,
      transactionLikelyFails: true,
    }),
    estimatedFeesPerGas: (
      immerState,
      {
        payload: { estimatedFeesPerGas, network },
      }: {
        payload: {
          estimatedFeesPerGas: BlockPrices
          network: NetworkInterface
        }
      }
    ) => {
      immerState.estimatedFeesPerGas = {
        ...(immerState.estimatedFeesPerGas ?? {}),
        [network.chainID]: {
          baseFeePerGas: estimatedFeesPerGas.baseFeePerGas,
          instant: makeBlockEstimate(INSTANT, estimatedFeesPerGas),
          express: makeBlockEstimate(EXPRESS, estimatedFeesPerGas),
          regular: makeBlockEstimate(REGULAR, estimatedFeesPerGas),
        },
      }
    },
    setCustomGas: (
      immerState,
      {
        payload: { maxPriorityFeePerGas, maxFeePerGas },
      }: {
        payload: {
          maxPriorityFeePerGas: bigint
          maxFeePerGas: bigint
        }
      }
    ) => {
      immerState.customFeesPerGas = {
        maxPriorityFeePerGas,
        maxFeePerGas,
        confidence: 0,
      }
    },
    clearCustomGas: (immerState) => {
      immerState.customFeesPerGas = defaultCustomGas
      immerState.feeTypeSelected = NetworkFeeTypeChosen.Regular
    },
    setCustomGasLimit: (
      immerState,
      { payload: gasLimit }: { payload: bigint | undefined }
    ) => {
      if (typeof gasLimit !== "undefined" && immerState.transactionRequest) {
        immerState.transactionRequest.gasLimit = gasLimit
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(updateTransactionData.pending, (immerState) => {
      immerState.status = TransactionConstructionStatus.Pending
      immerState.signedTransaction = undefined
    })
  },
})

export const {
  transactionRequest,
  clearTransactionState,
  signed,
  setFeeType,
  estimatedFeesPerGas,
  setCustomGas,
  clearCustomGas,
  setCustomGasLimit,
  setQuaiTransactionResponse,
} = transactionSlice.actions

export default transactionSlice.reducer

export const quaiTransactionResponse = createBackgroundAsyncThunk(
  "transaction-construction/quaiTransactionResponse",
  async (transaction: QuaiTransactionResponse, { dispatch }) => {
    dispatch(setQuaiTransactionResponse(JSON.stringify(transaction)))
  }
)

export const transactionSigned = createBackgroundAsyncThunk(
  "transaction-construction/transaction-signed",
  async (transaction: QuaiTransactionResponse, { dispatch }) => {
    dispatch(signed(JSON.stringify(transaction)))
  }
)

export const rejectSendTransaction = createBackgroundAsyncThunk(
  "transaction-construction/reject",
  async (_, { dispatch }) => {
    await emitter.emit("sendTransactionRejected")
    dispatch(
      transactionSlice.actions.clearTransactionState(
        TransactionConstructionStatus.Idle
      )
    )
  }
)
