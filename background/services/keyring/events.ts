import { ServiceLifecycleEvents } from "../types"
import { Keyring, PrivateKey, SignerImportSource } from "./types"

export interface KeyringServiceEvents extends ServiceLifecycleEvents {
  locked: boolean
  keyrings: {
    privateKeys: PrivateKey[]
    keyrings: Keyring[]
    keyringMetadata: {
      [keyringId: string]: { source: SignerImportSource }
    }
  }
  address: string
  signedData: string
}
