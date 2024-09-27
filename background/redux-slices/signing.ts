import { createSelector, createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { MessageSigningRequest, SignTypedDataRequest } from "../utils/signing"
import { createBackgroundAsyncThunk } from "./utils"
import { EnrichedSignTypedDataRequest } from "../services/enrichment"
import { EIP712TypedData } from "../types"
import { AddressOnNetwork } from "../accounts"
import { AccountSigner } from "../services/signing"
import { QuaiTransactionRequestWithAnnotation } from "../services/transactions/types"

/**
 * The different types of SignOperations that can be executed. These types
 * correspond to the signature requests that they carry.
 */
export type SignOperationType =
  | MessageSigningRequest
  | SignTypedDataRequest
  | QuaiTransactionRequestWithAnnotation

/**
 * A request for a signing operation carrying the AccountSigner whose signature
 * is requested and the request itself.
 */
export type SignOperation<T extends SignOperationType> = {
  request: T
  accountSigner: AccountSigner
}

type Events = {
  requestSignTypedData: {
    typedData: EIP712TypedData
    account: AddressOnNetwork
    accountSigner: AccountSigner
  }
  requestSignData: MessageSigningRequest & {
    accountSigner: AccountSigner
  }
  signatureRejected: never
}

export const signingSliceEmitter = new Emittery<Events>()

type SigningState = {
  signedTypedData: string | undefined
  typedDataRequest: EnrichedSignTypedDataRequest | undefined
  signedData: string | undefined
  signDataRequest: MessageSigningRequest | undefined
  additionalSigningStatus: "editing" | undefined
}

export const initialState: SigningState = {
  typedDataRequest: undefined,
  signedTypedData: undefined,
  signedData: undefined,
  signDataRequest: undefined,
  additionalSigningStatus: undefined,
}

export const signTypedData = createBackgroundAsyncThunk(
  "signing/signTypedData",
  async (data: SignOperation<SignTypedDataRequest>) => {
    const {
      request: { account, typedData },
      accountSigner,
    } = data

    await signingSliceEmitter.emit("requestSignTypedData", {
      typedData,
      account,
      accountSigner,
    })
  }
)

export const signData = createBackgroundAsyncThunk(
  "signing/signData",
  async (data: SignOperation<MessageSigningRequest>) => {
    const { request, accountSigner } = data
    await signingSliceEmitter.emit("requestSignData", {
      ...request,
      accountSigner,
    })
  }
)

const signingSlice = createSlice({
  name: "signing",
  initialState,
  reducers: {
    signedTypedData: (state, { payload }: { payload: string }) => ({
      ...state,
      signedTypedData: payload,
      typedDataRequest: undefined,
    }),
    typedDataRequest: (
      state,
      { payload }: { payload: EnrichedSignTypedDataRequest }
    ) => ({
      ...state,
      typedDataRequest: payload,
    }),
    signDataRequest: (
      state,
      { payload }: { payload: MessageSigningRequest }
    ) => {
      return {
        ...state,
        signDataRequest: payload,
      }
    },
    signedData: (state, { payload }: { payload: string }) => ({
      ...state,
      signedData: payload,
      signDataRequest: undefined,
    }),
    clearSigningState: (state) => ({
      ...state,
      typedDataRequest: undefined,
      signDataRequest: undefined,
      additionalSigningStatus: undefined,
    }),
    updateAdditionalSigningStatus: (
      state,
      { payload }: { payload: "editing" | undefined }
    ) => ({
      ...state,
      additionalSigningStatus: payload,
    }),
  },
})

export const {
  signedTypedData,
  typedDataRequest,
  signedData,
  signDataRequest,
  clearSigningState,
  updateAdditionalSigningStatus,
} = signingSlice.actions

export default signingSlice.reducer

export const selectTypedData = createSelector(
  (state: { signing: SigningState }) => state.signing.typedDataRequest,
  (signTypes) => signTypes
)

export const selectSigningData = createSelector(
  (state: { signing: SigningState }) => state.signing.signDataRequest,
  (signTypes) => signTypes
)

export const selectAdditionalSigningStatus = createSelector(
  (state: { signing: SigningState }) => state.signing.additionalSigningStatus,
  (additionalSigningStatus) => additionalSigningStatus
)

export const rejectDataSignature = createBackgroundAsyncThunk(
  "signing/reject",
  async (_, { dispatch }) => {
    await signingSliceEmitter.emit("signatureRejected")
    dispatch(signingSlice.actions.clearSigningState())
  }
)
