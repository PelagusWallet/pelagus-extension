import { BigNumber, ethers, utils } from "ethers"
import { normalizeHexAddress } from "@pelagus/hd-keyring"
import { NormalizedEVMAddress } from "../../types"
import { AddressOnNetwork } from "../../accounts"

export function normalizeEVMAddress(
  address: string | Buffer
): NormalizedEVMAddress {
  return normalizeHexAddress(address) as NormalizedEVMAddress
}

export function normalizeAddressOnNetwork({
  address,
  network,
}: AddressOnNetwork): AddressOnNetwork {
  return {
    address: normalizeEVMAddress(address),
    network,
  }
}

/**
 * Manually truncate number, try to cut as close to `decimalLength` as possible.
 * If number is less than 1 then look for significant digits in the decimal
 * up to `maxDecimalLength`.
 * @param value floating point number as a string or number
 * @param decimalLength desired length of decimal part
 * @param maxDecimalLength max length of decimal part - will try to look
 *                        for significant digits up to this point
 * @returns truncated number
 */
export function truncateDecimalAmount(
  value: number | string,
  decimalLength: number,
  maxDecimalLength = decimalLength
): string {
  const valueString = value.toString()

  if (!valueString.includes(".")) {
    return valueString
  }

  const [integer, decimals] = valueString.split(".")

  const firstSignificantDecimalDigit =
    [...decimals].findIndex((digit) => digit !== "0") + 1

  const decimalTruncationLength =
    integer.length > 1 || integer[0] !== "0"
      ? // For a value >=1, always respect decimalLength.
        decimalLength
      : // For a value <1, use the greater of decimalLength or first
        // significant decimal digit, up to maxDecimalLength.
        Math.min(
          Math.max(decimalLength, firstSignificantDecimalDigit),
          maxDecimalLength
        )

  // If the truncation point includes no significant decimals, don't include
  // the decimal component at all.
  if (decimalTruncationLength < firstSignificantDecimalDigit) {
    return integer
  }

  const decimalsTruncated = decimals.substring(0, decimalTruncationLength)

  return `${integer}.${decimalsTruncated}`
}

export function sameEVMAddress(
  address1: string | Buffer | undefined | null,
  address2: string | Buffer | undefined | null
): boolean {
  if (
    typeof address1 === "undefined" ||
    typeof address2 === "undefined" ||
    address1 === null ||
    address2 === null
  ) {
    return false
  }
  return normalizeHexAddress(address1) === normalizeHexAddress(address2)
}

export function gweiToWei(value: number | bigint): bigint {
  return BigInt(utils.parseUnits(value.toString(), "gwei").toString())
}

export function convertToEth(value: string | number | bigint): string {
  if (value && value >= 1) {
    return utils.formatUnits(BigInt(value))
  }
  return "0"
}

export function weiToGwei(value: string | number | bigint): string {
  if (value && value >= 1) {
    return truncateDecimalAmount(utils.formatUnits(BigInt(value), "gwei"), 2)
  }
  return ""
}

/**
 * Encode an unknown input as JSON, special-casing bigints and undefined.
 *
 * @param input an object, array, or primitive to encode as JSON
 */
export function encodeJSON(input: unknown): string {
  return JSON.stringify(input, (_, value) => {
    if (typeof value === "bigint") {
      return { B_I_G_I_N_T: value.toString() }
    }
    return value
  })
}

/**
 * Decode a JSON string, as encoded by `encodeJSON`, including bigint support.
 * Note that the functions aren't invertible, as `encodeJSON` discards
 * `undefined`.
 *
 * @param input a string output from `encodeJSON`
 */
export function decodeJSON(input: string): unknown {
  return JSON.parse(input, (_, value) =>
    value !== null && typeof value === "object" && "B_I_G_I_N_T" in value
      ? BigInt(value.B_I_G_I_N_T)
      : value
  )
}

export function isProbablyEVMAddress(str: string): boolean {
  if (normalizeHexAddress(str).startsWith("0x") && str.length === 42) {
    return true
  }
  return false
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-5)}`
}

export const isMaxUint256 = (amount: BigNumber | bigint | string): boolean => {
  return ethers.BigNumber.from(amount).eq(ethers.constants.MaxUint256)
}

export const wait = (ms: number): Promise<void> =>
  new Promise<void>((r) => setTimeout(r, ms))
