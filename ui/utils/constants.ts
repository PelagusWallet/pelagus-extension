import {
  QUAI_NETWORK_ORCHARD,
  QUAI_NETWORK_LOCAL,
  QUAI_NETWORK_GOLDEN_AGE,
  QUAI_NETWORK,
} from "@pelagus/pelagus-background/constants"
import { NetworkFeeTypeChosen } from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import { i18n } from "../_locales/i18n"

export const blockExplorer = {
  [QUAI_NETWORK.chainID]: {
    title: "Quaiscan",
    url:
      QUAI_NETWORK.chains !== undefined
        ? QUAI_NETWORK.chains[0].blockExplorerUrl
        : "",
  },
  [QUAI_NETWORK_GOLDEN_AGE.chainID]: {
    title: "Quaiscan",
    url:
      QUAI_NETWORK_GOLDEN_AGE.chains !== undefined
        ? QUAI_NETWORK_GOLDEN_AGE.chains[0].blockExplorerUrl
        : "",
  },
  [QUAI_NETWORK_ORCHARD.chainID]: {
    title: "Quaiscan Orchard",
    url:
      QUAI_NETWORK_ORCHARD.chains !== undefined
        ? QUAI_NETWORK_ORCHARD.chains[0].blockExplorerUrl
        : "",
  },
  [QUAI_NETWORK_LOCAL.chainID]: {
    title: "Quaiscan",
    url:
      QUAI_NETWORK_LOCAL.chains !== undefined
        ? QUAI_NETWORK_LOCAL.chains[0].blockExplorerUrl
        : "", // Do we want this to be colosseum explorer?
  },
}

export const ESTIMATED_SPEED_IN_READABLE_FORMAT_RELATIVE_TO_CONFIDENCE_LEVEL: {
  [confidence: number]: string
} = {
  1: "",
  0: i18n.t("networkFees.speeds.0"),
  70: i18n.t("networkFees.speeds.70"),
  95: i18n.t("networkFees.speeds.95"),
  99: i18n.t("networkFees.speeds.99"),
}

export const NETWORK_FEE_CHOSEN_TYPE_TO_HUMAN_READABLE_TYPE: {
  [confidence: string]: string
} = {
  [NetworkFeeTypeChosen.Auto]: "",
  [NetworkFeeTypeChosen.Regular]: i18n.t("networkFees.types.regular"),
  [NetworkFeeTypeChosen.Express]: i18n.t("networkFees.types.express"),
  [NetworkFeeTypeChosen.Instant]: i18n.t("networkFees.types.instant"),
  [NetworkFeeTypeChosen.Custom]: i18n.t("networkFees.types.custom"),
}
