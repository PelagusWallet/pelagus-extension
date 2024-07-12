import {
  toUtf8Bytes,
  hexlify,
  TypedDataDomain,
  TypedDataField,
  toUtf8String,
} from "quais"
import { SiweMessage } from "siwe"
import { AddressOnNetwork, AccountSignerWithId } from "../accounts"
import { EIP191Data, EIP712TypedData, HexString } from "../types"

export interface EIP4361Data {
  unparsedMessageData: string
  domain: string
  address: string
  version: string
  chainId: number
  nonce: string
  expiration?: string
  statement?: string
}

export type SignTypedDataRequest = {
  account: AddressOnNetwork
  typedData: EIP712TypedData
}

type EIP191SigningData = {
  messageType: "eip191"
  signingData: EIP191Data
}

type EIP4361SigningData = {
  messageType: "eip4361"
  signingData: EIP4361Data
}

export type MessageSigningData = EIP191SigningData | EIP4361SigningData

export type MessageSigningRequest<
  T extends MessageSigningData = MessageSigningData
> = T & {
  account: AddressOnNetwork
  rawSigningData: string
}

type EIP2612Message = {
  owner: HexString
  spender: HexString
  nonce: number
  value: number
  deadline: number
}

export type EIP2612TypedData = {
  domain: TypedDataDomain
  types: Record<string, TypedDataField[]>
  message: EIP2612Message
  primaryType: "Permit"
}

const checkEIP4361: (message: string) => EIP4361Data | undefined = (
  message
) => {
  try {
    const siweMessage = new SiweMessage(message)
    return {
      unparsedMessageData: message,
      domain: siweMessage.domain,
      address: siweMessage.address,
      statement: siweMessage.statement,
      version: siweMessage.version,
      chainId: siweMessage.chainId,
      expiration: siweMessage.expirationTime,
      nonce: siweMessage.nonce,
    }
  } catch (err) {}

  return undefined
}

/**
 * Takes a string and parses the string into a ExpectedSigningData Type
 *
 * EIP4361 standard can be found https://eips.ethereum.org/EIPS/eip-4361
 */
export function parseSigningData(signingData: string): MessageSigningData {
  let normalizedData = signingData

  // Attempt to normalize hex signing data to a UTF-8 string message. If the
  // signing data is <= 32 bytes long, assume it's a hash or other short data
  // that need not be normalized to a regular UTF-8 string.
  if (signingData.startsWith("0x") && signingData.length > 66) {
    let possibleMessageString: string | undefined
    try {
      possibleMessageString = toUtf8String(signingData)
      // Below, if the signing data is not a valid UTF-8 string, we move on
      // with an undefined possibleMessageString.
      // eslint-disable-next-line no-empty
    } catch (err) {}

    // If the hex was parsable as UTF-8 and re-converting to bytes in a hex
    // string produces the identical output, accept it as a valid string and
    // set the interpreted data to the UTF-8 string.
    if (
      possibleMessageString !== undefined &&
      hexlify(toUtf8Bytes(possibleMessageString)) === signingData.toLowerCase()
    ) {
      normalizedData = possibleMessageString
    }
  }

  const data = checkEIP4361(normalizedData)
  if (data)
    return {
      messageType: "eip4361",
      signingData: data,
    }

  return {
    messageType: "eip191",
    signingData: normalizedData,
  }
}

export const isSameAccountSignerWithId = (
  signerA: AccountSignerWithId,
  signerB: AccountSignerWithId
): boolean => {
  if (signerA.type !== signerB.type) return false

  switch (signerB.type) {
    case "private-key":
      return signerB.walletID === (signerA as typeof signerB).walletID
    case "keyring":
      return signerB.keyringID === (signerA as typeof signerB).keyringID
    default:
      return false
  }
}
