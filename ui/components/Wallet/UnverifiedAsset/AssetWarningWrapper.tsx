import React, { ReactElement, useEffect, useState } from "react"
import { SmartContractFungibleAsset } from "@pelagus/pelagus-background/assets"
import { selectCurrentAccount } from "@pelagus/pelagus-background/redux-slices/selectors"
import { Activity } from "@pelagus/pelagus-background/redux-slices/activities"
import SharedSlideUpMenu from "../../Shared/SharedSlideUpMenu"
import WalletActivityDetails from "../WalletActivityDetails"
import AssetWarning from "./AssetWarning"
import { useBackgroundSelector } from "../../../hooks"
import SharedModalHeaders from "../../Shared/_newDeisgn/modalWrapper/SharedModalHeaders"
import SharedModalWrapper from "../../Shared/_newDeisgn/modalWrapper/SharedModalWrapper"

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

  const handleCloseTxDetailsModal = () => {
    setActivityItem(undefined)
    setShowAssetWarning(true)
  }

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

      <SharedModalWrapper
        footer={<></>}
        header={
          <SharedModalHeaders
            title="Review Transaction"
            onClose={handleCloseTxDetailsModal}
            withGoBackIcon={false}
          />
        }
        isOpen={!!activityItem}
        onClose={handleCloseTxDetailsModal}
        customStyles={{ alignItems: "flex-end" }}
      >
        {activityItem && (
          <WalletActivityDetails
            activityItem={activityItem}
            activityInitiatorAddress={activityInitiatorAddress}
          />
        )}
      </SharedModalWrapper>
    </>
  )
}
