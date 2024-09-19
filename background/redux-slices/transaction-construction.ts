import { createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { QuaiTransactionLike } from "quais/lib/commonjs/transaction"
import { QuaiTransaction } from "quais"
import { QuaiTransactionResponse } from "quais/lib/commonjs/providers"
import { EXPRESS, INSTANT, MAX_FEE_MULTIPLIER, REGULAR } from "../constants"
import {
  BlockEstimate,
  BlockPrices,
  isEIP1559TransactionRequest,
} from "../networks"
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
  feeTypeSelected: NetworkFeeTypeChosen.Regular,
  estimatedFeesPerGas: {},
  transactionLikelyFails: false,
  customFeesPerGas: defaultCustomGas,
}

export type Events = {
  updateTransaction: QuaiTransactionRequestWithAnnotation

  requestSignature: SignOperation<QuaiTransactionRequestWithAnnotation>
  signatureRejected: never
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

export const signTransaction = createBackgroundAsyncThunk(
  "transaction-construction/sign",
  async (request: SignOperation<QuaiTransactionRequestWithAnnotation>) => {
    await emitter.emit("requestSignature", request)
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
      const newState = {
        ...state,
        status: TransactionConstructionStatus.Loaded,
        signedTransaction: undefined,
        transactionRequest: {
          ...transactionRequest,
        },
        transactionLikelyFails,
      }
      const feeType = state.feeTypeSelected

      if (
        // We use two guards here to satisfy the compiler but due to the spread
        // above we know that if one is an EIP1559 then the other one must be too
        isEIP1559TransactionRequest(newState.transactionRequest) &&
        isEIP1559TransactionRequest(transactionRequest)
      ) {
        const estimatedMaxFeePerGas =
          feeType === NetworkFeeTypeChosen.Custom
            ? state.customFeesPerGas?.maxFeePerGas
            : state.estimatedFeesPerGas?.chainId?.[feeType]?.maxFeePerGas // TODO-MIGRATION

        newState.transactionRequest.maxFeePerGas =
          estimatedMaxFeePerGas ?? transactionRequest.maxFeePerGas

        const estimatedMaxPriorityFeePerGas =
          feeType === NetworkFeeTypeChosen.Custom
            ? state.customFeesPerGas?.maxPriorityFeePerGas
            : state.estimatedFeesPerGas?.chainId?.[feeType] // TODO-MIGRATION
                ?.maxPriorityFeePerGas

        newState.transactionRequest.maxPriorityFeePerGas =
          estimatedMaxPriorityFeePerGas ??
          transactionRequest.maxPriorityFeePerGas

        // Gas minimums
        if (
          newState.transactionRequest.maxPriorityFeePerGas ??
          0n < 1000000000n
        ) {
          newState.transactionRequest.maxPriorityFeePerGas = 1000000000n
        }

        if (
          (newState.transactionRequest.maxFeePerGas ?? 0n) <
          (newState.transactionRequest.maxPriorityFeePerGas ?? 0n) + 1000000000n
        ) {
          newState.transactionRequest.maxFeePerGas =
            newState.transactionRequest.maxPriorityFeePerGas ?? 0n + 1000000000n
        }
      }

      return newState
    },
    clearTransactionState: (
      state,
      { payload }: { payload: TransactionConstructionStatus }
    ) => ({
      estimatedFeesPerGas: state.estimatedFeesPerGas,
      status: payload,
      feeTypeSelected: state.feeTypeSelected ?? NetworkFeeTypeChosen.Regular,
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
      signedTransaction: JSON.parse(payload), // TODO-MIGRATION
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
      if (
        typeof gasLimit !== "undefined" &&
        immerState.transactionRequest &&
        isEIP1559TransactionRequest(immerState.transactionRequest)
      ) {
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
  async (transaction: QuaiTransaction, { dispatch, getState }) => {
    dispatch(signed(JSON.stringify(transaction)))

    const { transactionConstruction } = getState() as {
      transactionConstruction: TransactionConstruction
    }

    if (transactionConstruction.broadcastOnSign ?? false) {
      await emitter.emit("broadcastSignedTransaction", transaction)
    }
  }
)

export const rejectTransactionSignature = createBackgroundAsyncThunk(
  "transaction-construction/reject",
  async (_, { dispatch }) => {
    await emitter.emit("signatureRejected")
    dispatch(
      transactionSlice.actions.clearTransactionState(
        TransactionConstructionStatus.Idle
      )
    )
  }
)
