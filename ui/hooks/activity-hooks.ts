import { HexString } from "@pelagus/pelagus-background/types"
import {
  Activity,
  INFINITE_VALUE,
} from "@pelagus/pelagus-background/redux-slices/activities"
import { sameEVMAddress } from "@pelagus/pelagus-background/lib/utils"
import { useTranslation } from "react-i18next"
import { TransactionAnnotation } from "@pelagus/pelagus-background/services/enrichment"

function isReceiveActivity(
  activity: Activity,
  activityInitiatorAddress: string
): boolean {
  return (
    (activity.type === "asset-transfer" || activity.type === "external-transfer") &&
    sameEVMAddress(activity.recipient?.address, activityInitiatorAddress)
  )
}

// The asset-transfer activity type splits into send and receive actions.
// Therefore, we exclude it from the activity icon types and add more precise types for it.
export type ActivityIconType =
  | Exclude<TransactionAnnotation["type"], "asset-transfer">
  | "asset-transfer-receive"
  | "asset-transfer-send"

type ActivityViewDetails = {
  icon: ActivityIconType
  label: string
  recipient: {
    address?: HexString
    name?: string
  }
  assetLogoURL?: string
  assetSymbol: string
  assetValue: string
}

export default function useActivityViewDetails(
  activity: Activity,
  activityInitiatorAddress: string
): ActivityViewDetails {
  const { t } = useTranslation("translation", {
    keyPrefix: "wallet.activities",
  })
  const baseDetails = {
    recipient: activity.recipient,
    assetLogoURL: activity.assetLogoUrl,
    assetSymbol: activity.assetSymbol,
    assetValue: activity.value,
  }
  switch (activity.type) {
    case "asset-transfer":
      return {
        ...baseDetails,
        label: isReceiveActivity(activity, activityInitiatorAddress)
          ? t("tokenReceived")
          : t("tokenSent"),
        icon: isReceiveActivity(activity, activityInitiatorAddress)
          ? "asset-transfer-receive"
          : "asset-transfer-send",
      }
    case "asset-approval":
      return {
        ...baseDetails,
        label: t("tokenApproved"),
        icon: "asset-approval",
        assetValue:
          activity.value === INFINITE_VALUE
            ? t("infiniteApproval")
            : activity.value,
      }
    case "asset-swap":
      return {
        ...baseDetails,
        icon: "asset-swap",
        label: t("tokenSwapped"),
      }
    case "external-transfer":
      return {
        ...baseDetails,
        icon: isReceiveActivity(activity, activityInitiatorAddress)
          ? "asset-transfer-receive"
          : "asset-transfer-send",
        label: isReceiveActivity(activity, activityInitiatorAddress)
          ? t("externalReceived")
          : t("externalSend"),
      }
    case "contract-deployment":
    case "contract-interaction":
    default:
      return {
        ...baseDetails,
        icon: "contract-interaction",
        label: t("contractInteraction"),
      }
  }
}
