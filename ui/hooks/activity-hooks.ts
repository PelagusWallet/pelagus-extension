import { Activity } from "@pelagus/pelagus-background/redux-slices/activities"
import { sameQuaiAddress } from "@pelagus/pelagus-background/lib/utils"
import { TransactionAnnotation } from "@pelagus/pelagus-background/services/enrichment"

export function isReceiveActivity(
  activity: Activity,
  activityInitiatorAddress: string
): boolean {
  return (
    (activity.type === "asset-transfer" ||
      activity.type === "external-transfer") &&
    sameQuaiAddress(activity.recipient?.address, activityInitiatorAddress)
  )
}

// The asset-transfer activity type splits into send and receive actions.
// Therefore, we exclude it from the activity icon types and add more precise types for it.
export type ActivityIconType =
  | Exclude<TransactionAnnotation["type"], "asset-transfer">
  | "asset-transfer-receive"
  | "asset-transfer-send"
  | "asset-convert"
