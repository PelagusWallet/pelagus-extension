import { SignOperationType } from "@pelagus/pelagus-background/redux-slices/signing"
import { AccountSigner } from "@pelagus/pelagus-background/services/signing"
import { ReactElement } from "react"
import { ResolvedSignatureDetails } from "../SignatureDetails"

/**
 * The props passed to a signer-specific frame, as well as to the dispatcher
 * component SignerFrame.
 */
export type SignerFrameProps<T extends SignOperationType> =
  ResolvedSignatureDetails & {
    request: T
    signer: AccountSigner
    coin?: "quai" | "qi"
    /**
     * The children a signer frame should render to present the user with
     * additional information about the data being signed.
     */
    children: ReactElement
  }
