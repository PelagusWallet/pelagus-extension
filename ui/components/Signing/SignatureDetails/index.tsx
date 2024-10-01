import React, { ReactElement } from "react"
import {
  rejectDataSignature,
  signData,
  SignOperation,
  SignOperationType,
  signTypedData,
} from "@pelagus/pelagus-background/redux-slices/signing"
import {
  rejectSendTransaction,
  sendTransaction,
} from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import {
  MessageSigningRequest,
  SignTypedDataRequest,
} from "@pelagus/pelagus-background/utils/signing"
import { AccountSigner } from "@pelagus/pelagus-background/services/signing"
import { AddressOnNetwork } from "@pelagus/pelagus-background/accounts"
import { AnyAction } from "redux"
import { QuaiTransactionRequestWithAnnotation } from "@pelagus/pelagus-background/services/transactions/types"
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

export function resolveTransactionSendDetails({
  request,
  accountSigner,
}: SignOperation<QuaiTransactionRequestWithAnnotation>): ResolvedSignatureDetails {
  return {
    signer: accountSigner,
    signingAddress: {
      address: request?.from && request.from.toString(),
      network: request.network,
    },
    signingActionLabelI18nKey: "signTransaction.confirmButtonLabel",
    renderedSigningData: (
      <TransactionSignatureDetails transactionRequest={request} />
    ),
    signActionCreator: () => sendTransaction({ request, accountSigner }),
    rejectActionCreator: rejectSendTransaction,
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
  return resolveTransactionSendDetails({ request, accountSigner })
}

export function useResolvedSignatureDetails<T extends SignOperationType>(
  signOperation: SignOperation<T> | undefined
): ResolvedSignatureDetails | undefined {
  return signOperation === undefined
    ? undefined
    : resolveSignatureDetails(signOperation)
}
