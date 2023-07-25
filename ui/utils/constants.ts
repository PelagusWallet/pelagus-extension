import {
  ARBITRUM_NOVA,
  ARBITRUM_ONE,
  AVALANCHE,
  BINANCE_SMART_CHAIN,
  ETHEREUM,
  GOERLI,
  OPTIMISM,
  POLYGON,
  QUAI_NETWORK,
  QUAI_NETWORK_LOCAL,
  ROOTSTOCK,
} from "@tallyho/tally-background/constants"
import { NetworkFeeTypeChosen } from "@tallyho/tally-background/redux-slices/transaction-construction"
import { i18n } from "../_locales/i18n"

export const doggoTokenDecimalDigits = 18

export const blockExplorer = {
  [ETHEREUM.chainID]: { title: "Etherscan", url: "https://etherscan.io" },
  [ROOTSTOCK.chainID]: { title: "RSKExplorer", url: "https://explorer.rsk.co" },
  [OPTIMISM.chainID]: {
    title: "Etherscan",
    url: "https://optimistic.etherscan.io",
  },
  [POLYGON.chainID]: { title: "Polygonscan", url: "https://polygonscan.com" },
  [GOERLI.chainID]: { title: "Etherscan", url: "https://goerli.etherscan.io/" },
  [ARBITRUM_ONE.chainID]: { title: "Arbiscan", url: "https://arbiscan.io/" },
  [AVALANCHE.chainID]: { title: "Snowtrace", url: "https://snowtrace.io/" },
  [BINANCE_SMART_CHAIN.chainID]: {
    title: "BscScan",
    url: "https://bscscan.com",
  },
  [ARBITRUM_NOVA.chainID]: {
    title: "Arbiscan",
    url: "https://nova.arbiscan.io/",
  },
  [QUAI_NETWORK.chainID]: {
    title: "Quai Blockscout",
    url: "https://cyprus1.colosseum.quaiscan.io", // TODO: update this per shard
  },
  [QUAI_NETWORK_LOCAL.chainID]: {
    title: "Quai Blockscout",
    url: "https://cyprus1.colosseum.quaiscan.io", // TODO: update this per shard
  }
}

export const ESTIMATED_SPEED_IN_READABLE_FORMAT_RELATIVE_TO_CONFIDENCE_LEVEL: {
  [confidence: number]: string
} = {
  0: i18n.t("networkFees.speeds.0"),
  70: i18n.t("networkFees.speeds.70"),
  95: i18n.t("networkFees.speeds.95"),
  99: i18n.t("networkFees.speeds.99"),
}

export const NETWORK_FEE_CHOSEN_TYPE_TO_HUMAN_READABLE_TYPE: {
  [confidence: string]: string
} = {
  [NetworkFeeTypeChosen.Regular]: i18n.t("networkFees.types.regular"),
  [NetworkFeeTypeChosen.Express]: i18n.t("networkFees.types.express"),
  [NetworkFeeTypeChosen.Instant]: i18n.t("networkFees.types.instant"),
  [NetworkFeeTypeChosen.Custom]: i18n.t("networkFees.types.custom"),
}
