import { QuaiTransaction } from "quais"
import {
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import KeyringService from "../keyring"
import { EIP712TypedData, HexString } from "../../types"
import BaseService from "../base"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import ChainService from "../chain"
import { AddressOnNetwork } from "../../accounts"
import { assertUnreachable } from "../../lib/utils/type-guards"
import { KeyringAccountSigner, PrivateKeyAccountSigner } from "../keyring/types"

type SigningErrorReason = "userRejected" | "genericError"
type ErrorResponse = {
  type: "error"
  reason: SigningErrorReason
}

export type SignTransactionResponse =
  | {
      type: "success-tx"
      signedTx: QuaiTransaction
    }
  | ErrorResponse

export type SignatureResponse =
  | {
      type: "success-data"
      signedData: string
    }
  | ErrorResponse

type Events = ServiceLifecycleEvents & {
  signTransactionResponse: SignTransactionResponse
  signingDataResponse: SignatureResponse
  personalSigningResponse: SignatureResponse
}

/**
 * An AccountSigner that represents a read-only account. Read-only accounts
 * generally cannot sign.
 */
export const ReadOnlyAccountSigner = { type: "read-only" } as const

/**
 * An AccountSigner carries the appropriate information for a given signer to
 * act on a signing request. The `type` field always carries the signer type,
 * but the rest of the object is signer-specific and should be treated as
 * opaque outside the specific signer's service.
 */
export type AccountSigner =
  | typeof ReadOnlyAccountSigner
  | PrivateKeyAccountSigner
  | KeyringAccountSigner

export type SignerType = AccountSigner["type"]

type AddressHandler = {
  address: string
  signer: SignerType
}

function getSigningErrorReason(err: unknown): SigningErrorReason {
  return "genericError"
}

/**
 * The SigningService is intended hide and demultiplex of accesses
 * to concrete signer implementations.
 *
 * It also emits all the abstract signing-related event to subscribers
 * grabbing this responsibility from each different implementation.
 *
 */
export default class SigningService extends BaseService<Events> {
  addressHandlers: AddressHandler[] = []

  static create: ServiceCreatorFunction<
    Events,
    SigningService,
    [Promise<KeyringService>, Promise<ChainService>]
  > = async (keyringService, chainService) => {
    return new this(await keyringService, await chainService)
  }

  private constructor(
    private keyringService: KeyringService,
    private chainService: ChainService
  ) {
    super()
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService() // Not needed, but better to stick to the patterns
  }

  async deriveAddress(signer: AccountSigner): Promise<HexString> {
    if (signer.type === "keyring")
      return this.keyringService.deriveAddress(signer)

    throw new Error(`Unknown signerID: ${signer}`)
  }

  async removeAccount(
    address: HexString,
    signerType?: SignerType
  ): Promise<void> {
    if (signerType) {
      switch (signerType) {
        case "private-key":
          await this.keyringService.removeWallet(address)
          break
        case "keyring":
          await this.keyringService.removeQuaiHDWallet(address)
          break
        case "read-only":
          break
        default:
          assertUnreachable(signerType)
      }
    }
    await this.chainService.removeAccountToTrack(address)
  }

  addTrackedAddress(address: string, handler: SignerType): void {
    this.addressHandlers.push({ address, signer: handler })
  }

  /// /////////////////////////////////////////Sign Methods////////////////////////////////////////////
  async signAndSendQuaiTransaction(
    transactionRequest: QuaiTransactionRequest,
    accountSigner: AccountSigner
  ): Promise<QuaiTransactionResponse> {
    try {
      let transactionResponse: QuaiTransactionResponse | null

      switch (accountSigner.type) {
        case "private-key":
        case "keyring": {
          transactionResponse =
            await this.chainService.signAndSendQuaiTransaction(
              transactionRequest
            )
          break
        }
        case "read-only":
          throw new Error("Read-only signers cannot sign.")
        default:
          return assertUnreachable(accountSigner)
      }

      if (!transactionResponse) {
        throw new Error("Transaction response is null.")
      }

      return transactionResponse
    } catch (err) {
      await this.emitter.emit("signTransactionResponse", {
        type: "error",
        reason: getSigningErrorReason(err),
      })
      throw err
    }
  }

  async signTransaction(
    transactionRequest: QuaiTransactionRequest,
    accountSigner: AccountSigner
  ): Promise<QuaiTransaction> {
    try {
      let signedTransactionString = ""
      switch (accountSigner.type) {
        case "private-key":
        case "keyring": {
          signedTransactionString =
            await this.keyringService.signQuaiTransaction(transactionRequest)
          break
        }
        case "read-only":
          throw new Error("Read-only signers cannot sign.")
        default:
          return assertUnreachable(accountSigner)
      }

      const signedTransaction = QuaiTransaction.from(signedTransactionString)

      await this.emitter.emit("signTransactionResponse", {
        type: "success-tx",
        signedTx: signedTransaction,
      })

      return signedTransaction
    } catch (err) {
      await this.emitter.emit("signTransactionResponse", {
        type: "error",
        reason: getSigningErrorReason(err),
      })

      throw err
    }
  }

  async signTypedData(
    typedData: EIP712TypedData,
    account: AddressOnNetwork,
    accountSigner: AccountSigner
  ): Promise<string> {
    try {
      let signedData: string
      const chainId =
        typeof typedData.domain.chainId === "string"
          ? // eslint-disable-next-line radix
            parseInt(typedData.domain.chainId)
          : typedData.domain.chainId
      if (
        typedData.domain.chainId !== undefined &&
        // Let parseInt infer radix by prefix; chainID can be hex or decimal,
        // though it should generally be hex.
        // eslint-disable-next-line radix
        chainId !== parseInt(account.network.chainID)
      ) {
        throw new Error(
          "Attempting to sign typed data with mismatched chain IDs."
        )
      }

      switch (accountSigner.type) {
        case "private-key":
        case "keyring":
          signedData = await this.keyringService.signTypedData(
            account.address,
            typedData
          )
          break
        case "read-only":
          throw new Error("Read-only signers cannot sign.")
        default:
          assertUnreachable(accountSigner)
      }
      this.emitter.emit("signingDataResponse", {
        type: "success-data",
        signedData,
      })

      return signedData
    } catch (err) {
      this.emitter.emit("signingDataResponse", {
        type: "error",
        reason: getSigningErrorReason(err),
      })

      throw err
    }
  }

  async signData(
    addressOnNetwork: AddressOnNetwork,
    hexDataToSign: HexString,
    accountSigner: AccountSigner
  ): Promise<string> {
    if (!hexDataToSign.startsWith("0x")) {
      throw new Error("Signing service can only sign hex data.")
    }

    try {
      let signedData
      switch (accountSigner.type) {
        case "private-key":
        case "keyring":
          signedData = await this.keyringService.personalSign(
            addressOnNetwork.address,
            hexDataToSign
          )
          break
        case "read-only":
          throw new Error("Read-only signers cannot sign.")
        default:
          assertUnreachable(accountSigner)
      }

      this.emitter.emit("personalSigningResponse", {
        type: "success-data",
        signedData,
      })
      return signedData
    } catch (err) {
      this.emitter.emit("personalSigningResponse", {
        type: "error",
        reason: "genericError",
      })
      throw err
    }
  }
}
