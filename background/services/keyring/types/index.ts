import {
  QiHDWallet,
  QuaiHDWallet,
  SerializedHDWallet,
  SerializedQiHDWallet,
  Wallet,
  Zone,
} from "quais"
import { HexString } from "../../../types"

export enum KeyringTypes {
  mnemonicBIP47 = "mnemonic#bip47",
  mnemonicBIP39S256 = "mnemonic#bip39:256",
  singleSECP = "single#secp256k1",
}

export type KeyringMetadata = {
  [keyringId: string]: { source: SignerImportSource }
}

export type HiddenAccounts = { [address: HexString]: boolean }

export type PublicWalletsData = {
  wallets: PrivateKey[]
  qiHDWallet: QiWallet | null
  quaiHDWallets: Keyring[]
  keyringMetadata: {
    [keyringId: string]: { source: SignerImportSource }
  }
}

export type DeleteProps = {
  walletId?: string
  hdWalletId?: string
  metadataKey?: string
  hiddenAccount?: string
}

export interface AddOptions {
  overwriteWallets?: boolean
  overwriteQuaiHDWallets?: boolean
  overwriteMetadata?: boolean
  overwriteHiddenAccounts?: boolean
}

export type AddressWithQiHDWallet = {
  address: string
  qiHDWallet: QiHDWallet
}

export type AddressWithQuaiHDWallet = {
  address: string
  quaiHDWallet: QuaiHDWallet
}

export type AddressWithPublicKey = { address: string; publicKey: string }

export type Keyring = {
  type: KeyringTypes
  id: string
  path: string | null
  addresses: string[]
}

export type QiWallet = Keyring & {
  paymentCode: string
}

export type PrivateKey = Keyring & {
  type: KeyringTypes.singleSECP
  path: null
  addresses: string[]
}

export type KeyringAccountSigner = {
  type: "keyring"
  keyringID: string
  zone: Zone
}
export type PrivateKeyAccountSigner = {
  type: "private-key"
  walletID: string
  zone: Zone
}

export type SerializedPrivateKey = {
  id: string
  version: number
  privateKey: string
}

export interface SerializedVaultData {
  wallets: SerializedPrivateKey[]
  qiHDWallet: SerializedQiHDWallet | null
  quaiHDWallets: SerializedHDWallet[]
  metadata: { [keyringId: string]: { source: SignerImportSource } }
  hiddenAccounts: { [address: HexString]: boolean }
}

export enum SignerSourceTypes {
  privateKey = "privateKey",
  keyring = "keyring",
}

export enum SignerImportSource {
  import = "import",
  internal = "internal",
}

type ImportMetadataPrivateKey = {
  type: SignerSourceTypes.privateKey
  privateKey: string
}
type ImportMetadataHDKeyring = {
  type: SignerSourceTypes.keyring
  mnemonic: string
  source: SignerImportSource
  path?: string
}
export type SignerImportMetadata =
  | ImportMetadataPrivateKey
  | ImportMetadataHDKeyring

export type InternalSignerHDKeyring = {
  signer: QuaiHDWallet
  address: string
  type: SignerSourceTypes.keyring
}
export type InternalSignerPrivateKey = {
  signer: Wallet
  address: string
  type: SignerSourceTypes.privateKey
}
export type InternalSignerWithType =
  | InternalSignerPrivateKey
  | InternalSignerHDKeyring
