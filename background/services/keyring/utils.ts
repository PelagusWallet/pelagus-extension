import { Mnemonic, randomBytes } from "quais"
import {
  InternalSignerPrivateKey,
  InternalSignerWithType,
  SignerSourceTypes,
} from "./types"

export const isSignerPrivateKeyType = (
  signer: InternalSignerWithType
): signer is InternalSignerPrivateKey =>
  signer.type === SignerSourceTypes.privateKey

export const generateRandomBytes = (numWords: number): Uint8Array => {
  const strength = (numWords / 3) * 32
  return randomBytes(strength / 8)
}

export const generateMnemonic = (): string => {
  const { phrase } = Mnemonic.fromEntropy(generateRandomBytes(24))
  return phrase
}

export const customError = "customError"
