import { TypedDataField, TypedDataDomain } from "quais"

/**
 * Named type for strings that should be domain names.
 *
 * Currently, *does not offer type safety*, just documentation value; see
 * https://github.com/microsoft/TypeScript/issues/202 and
 * https://github.com/microsoft/TypeScript/issues/41160 for TS features that
 * would give this some more teeth. Right now, any `string` can be assigned
 * into a variable of type `DomainName` and vice versa.
 */
export type DomainName = string

/**
 * Named type for strings that should be hexadecimal numbers.
 *
 * Currently, *does not offer type safety*, just documentation value; see
 * https://github.com/microsoft/TypeScript/issues/202 and
 * https://github.com/microsoft/TypeScript/issues/41160 for TS features that
 * would give this some more teeth. Right now, any `string` can be assigned
 * into a variable of type `HexString` and vice versa.
 */
export type HexString = string

/*
 * Named type for a number measuring time in seconds since the Unix Epoch,
 * January 1st, 1970 UTC.
 *
 * Currently *does not offer type safety*, just documentation value; see
 * https://github.com/microsoft/TypeScript/issues/202 and for a TS feature that
 * would give this some more teeth. Right now, any `number` can be assigned
 * into a variable of type `UNIXTime` and vice versa.
 */
export type UNIXTime = number

export type EIP191Data = string

export type EIP712TypedData<T = Record<string, unknown>> = {
  domain: TypedDataDomain
  types: Record<string, TypedDataField[]>
  message: T
  primaryType: string
}

export type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> }
