import { JTDDataType, ValidateFunction } from "ajv/dist/jtd"
import { metadataJTD } from "./erc721"

export const isValidMetadata: ValidateFunction<JTDDataType<typeof metadataJTD>>

/**
 * Helper type that can extract the concrete TypeScript type that a JTD
 * validation function is checking for. This allows using and aliasing the
 * JTD-inferred types without redefining them in TypeScript.
 *
 * Sample usage:
 * ```
 * type ZrxQuote = ValidatedType<typeof isValidSwapQuoteResponse>
 * ```
 */
export type ValidatedType<T> = T extends ValidateFunction<infer V> ? V : never
