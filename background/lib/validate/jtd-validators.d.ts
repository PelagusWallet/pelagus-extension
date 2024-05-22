import { JTDDataType, ValidateFunction } from "ajv/dist/jtd"
import { swapPriceJTD, swapQuoteJTD } from "./0x-swap"

export const isValidSwapPriceResponse: ValidateFunction<
  JTDDataType<typeof swapPriceJTD>
>

export const isValidSwapQuoteResponse: ValidateFunction<
  JTDDataType<typeof swapQuoteJTD>
>

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
