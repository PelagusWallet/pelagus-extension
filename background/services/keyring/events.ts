import { ServiceLifecycleEvents } from "../types"
import { Keyring, PrivateKey, QiWallet, SignerImportSource } from "./types"

export interface KeyringServiceEvents extends ServiceLifecycleEvents {
  locked: boolean
  keyrings: {
    privateKeys: PrivateKey[]
    qiHDWallets: QiWallet[]
    keyrings: Keyring[]
    keyringMetadata: {
      [keyringId: string]: { source: SignerImportSource }
    }
  }
  address: string
  signedData: string
}
