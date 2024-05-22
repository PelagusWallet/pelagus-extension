import { NormalizedEVMAddress } from "./types"

type HoldERC20 = {
  type: "hold"
  address: string
}

type AllowList = {
  type: "allowList"
}

type Unknown = {
  type: "unknown"
}

export type AbilityRequirement = HoldERC20 | AllowList | Unknown

export const ABILITY_TYPES_ENABLED = [
  "mint",
  "airdrop",
  "vote",
  "access",
  "claim",
] as const
// https://docs.daylight.xyz/reference/ability-model#ability-types
export const ABILITY_TYPES = [
  ...ABILITY_TYPES_ENABLED,
  "event",
  // Abilities type `article` and `result` will be fetched from the new endpoint.
  // Let's exclude this type for a moment.
  // TODO Fetch abilities from the correct endpoint.
  // "article",
  // "result",
  "misc",
] as const

export type AbilityType = typeof ABILITY_TYPES[number]

export type Ability = {
  type: AbilityType
  title: string
  description: string | null
  abilityId: string
  slug: string
  linkUrl: string
  imageUrl?: string
  openAt?: string
  closeAt?: string
  completed: boolean
  removedFromUi: boolean
  address: NormalizedEVMAddress
  requirement: AbilityRequirement
  /**
   * Order number from the most interesting to the user.
   * A lower number indicates a more interesting ability.
   * Rank is determined by the order in which data arrives from the Daylight API.
   */
  interestRank: number
}

export const ABILITY_TYPE_COLOR = {
  mint: "#20c580",
  airdrop: "#FF1E6F",
  vote: "#E3C10B",
  result: "#E3C10B",
  access: "#02C0EA",
  event: "#FF8A1E",
  article: "#B2B2B2",
  misc: "#CBCBCB",
  claim: "#F4D530",
}
