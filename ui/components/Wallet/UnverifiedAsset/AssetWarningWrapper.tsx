import React, { ReactElement, useEffect, useState } from "react"
import { SmartContractFungibleAsset } from "@pelagus/pelagus-background/assets"
import { selectCurrentAccount } from "@pelagus/pelagus-background/redux-slices/selectors"
import { Activity } from "@pelagus/pelagus-background/redux-slices/activities"
import SharedSlideUpMenu from "../../Shared/SharedSlideUpMenu"
import WalletActivityDetails from "../WalletActivityDetails"
import AssetWarning from "./AssetWarning"
import { useBackgroundSelector } from "../../../hooks"

type AssetWarningWrapperProps = {
  asset: SmartContractFungibleAsset | null
  close: () => void
}

export default function AssetWarningWrapper(
  props: AssetWarningWrapperProps
): ReactElement {
  const { asset, close } = props

  const [showAssetWarning, setShowAssetWarning] = useState(!!asset)
  const [activityItem, setActivityItem] = useState<Activity | undefined>(
    undefined
  )

  const activityInitiatorAddress =
    useBackgroundSelector(selectCurrentAccount).address

  useEffect(() => {
    setShowAssetWarning(!!asset)
  }, [asset])

  return (
    <>
      <SharedSlideUpMenu
        isOpen={showAssetWarning}
        size="auto"
        close={() => close()}
      >
        {asset && (
          <AssetWarning
            asset={asset}
            close={() => close()}
            openActivityDetails={(activity) => {
              setActivityItem(activity)
              setShowAssetWarning(false)
            }}
          />
        )}
      </SharedSlideUpMenu>

      <SharedSlideUpMenu
        isOpen={!!activityItem}
        size="custom"
        close={() => {
          setActivityItem(undefined)
          setShowAssetWarning(true)
        }}
      >
        {activityItem && (
          <WalletActivityDetails
            activityItem={activityItem}
            activityInitiatorAddress={activityInitiatorAddress}
          />
        )}
      </SharedSlideUpMenu>
    </>
  )
}
