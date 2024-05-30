// This file includes SLIP-0044 data used by the extension. Because this is raw
// data but is important, it SHOULD NOT be imported from an external package.

export const COIN_TYPES_BY_ASSET_SYMBOL = {
  QUAI: 994,
} as const

// All coin types known to the extension
export type Slip44CoinType =
  typeof COIN_TYPES_BY_ASSET_SYMBOL[keyof typeof COIN_TYPES_BY_ASSET_SYMBOL]
