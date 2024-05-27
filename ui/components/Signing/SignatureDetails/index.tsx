import React, { ReactElement } from "react"
import { TransactionRequest } from "@pelagus/pelagus-background/networks"
import {
  rejectDataSignature,
  signData,
  SignOperation,
  SignOperationType,
  signTypedData,
} from "@pelagus/pelagus-background/redux-slices/signing"
import {
  rejectTransactionSignature,
  signTransaction,
} from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import {
  MessageSigningRequest,
  SignTypedDataRequest,
} from "@pelagus/pelagus-background/utils/signing"
import { AccountSigner } from "@pelagus/pelagus-background/services/signing"
import { AddressOnNetwork } from "@pelagus/pelagus-background/accounts"
import { AnyAction } from "redux"
import TransactionSignatureDetails from "./TransactionSignatureDetails"
import MessageDataSignatureDetails from "./DataSignatureDetails/MessageDataSignatureDetails"
import TypedDataSignatureDetails from "./DataSignatureDetails/TypedDataSignatureDetails"

/**
 * Details regarding a signature request, resolved for a signer ahead of time
 * based on the type of signature, the account whose signature is being
 * requested, and the network on which that signature is taking place; see
 * `resolveSignatureDetails`.
 */
export type ResolvedSignatureDetails = {
  signer: AccountSigner
  signingAddress: AddressOnNetwork
  renderedSigningData: ReactElement
  signingActionLabelI18nKey:
    | "signTransaction.confirmButtonLabel"
    // FIXME Move out of signTransaction once old flow is removed???
    | "signTransaction.signTypedData.confirmButtonLabel"
  signActionCreator: () => AnyAction
  rejectActionCreator: () => AnyAction
  redirectToActivityPage?: boolean
}

export function resolveTransactionSignatureDetails({
  request,
  accountSigner,
}: SignOperation<TransactionRequest>): ResolvedSignatureDetails {
  return {
    signer: accountSigner,
    signingAddress: { address: request.from, network: request.network },
    signingActionLabelI18nKey: "signTransaction.confirmButtonLabel",
    renderedSigningData: (
      <TransactionSignatureDetails transactionRequest={request} />
    ),
    signActionCreator: () => signTransaction({ request, accountSigner }),
    rejectActionCreator: rejectTransactionSignature,
  }
}
export function resolveDataSignatureDetails({
  request,
  accountSigner,
}: SignOperation<MessageSigningRequest>): ResolvedSignatureDetails {
  return {
    signer: accountSigner,
    signingAddress: request.account,
    signingActionLabelI18nKey: "signTransaction.confirmButtonLabel",
    renderedSigningData: (
      <MessageDataSignatureDetails messageRequest={request} />
    ),
    signActionCreator: () => signData({ request, accountSigner }),
    rejectActionCreator: rejectDataSignature,
  }
}

export function resolveTypedDataSignatureDetails({
  request,
  accountSigner,
}: SignOperation<SignTypedDataRequest>): ResolvedSignatureDetails {
  return {
    signer: accountSigner,
    signingAddress: request.account,
    signingActionLabelI18nKey:
      "signTransaction.signTypedData.confirmButtonLabel",
    renderedSigningData: (
      <TypedDataSignatureDetails typedDataRequest={request} />
    ),
    signActionCreator: () => signTypedData({ request, accountSigner }),
    rejectActionCreator: rejectDataSignature,
  }
}

// Takes a signing request and resolves the signer that should be used to sign
// it and the details of signing data for user presentation.
export function resolveSignatureDetails<T extends SignOperationType>({
  request,
  accountSigner,
}: SignOperation<T>): ResolvedSignatureDetails {
  if ("signingData" in request) {
    return resolveDataSignatureDetails({ request, accountSigner })
  }
  if ("typedData" in request) {
    return resolveTypedDataSignatureDetails({ request, accountSigner })
  }
  return resolveTransactionSignatureDetails({ request, accountSigner })
}

export function useResolvedSignatureDetails<T extends SignOperationType>(
  signOperation: SignOperation<T> | undefined
): ResolvedSignatureDetails | undefined {
  return signOperation === undefined
    ? undefined
    : resolveSignatureDetails(signOperation)
}
