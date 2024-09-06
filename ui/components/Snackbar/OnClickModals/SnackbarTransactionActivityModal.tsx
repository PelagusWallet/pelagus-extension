import React from "react"
import {
  resetSnackbarConfig,
  setShowingActivityDetail,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { useDispatch } from "react-redux"
import WalletActivityDetails from "../../Wallet/WalletActivityDetails"
import SharedSlideUpMenu from "../../Shared/SharedSlideUpMenu"
import { useBackgroundSelector } from "../../../hooks"
import {
  selectCurrentAccount,
  selectShowingActivityDetail,
} from "@pelagus/pelagus-background/redux-slices/selectors"

const SnackbarTransactionActivityModal = () => {
  const dispatch = useDispatch()

  const showingActivityDetail = useBackgroundSelector(
    selectShowingActivityDetail
  )

  const currentAddress = useBackgroundSelector(selectCurrentAccount).address
  return (
    <SharedSlideUpMenu
      isOpen={!!showingActivityDetail}
      close={() => {
        dispatch(setShowingActivityDetail(null))
        dispatch(resetSnackbarConfig())
      }}
    >
      {showingActivityDetail && (
        <WalletActivityDetails
          activityItem={showingActivityDetail}
          activityInitiatorAddress={currentAddress}
        />
      )}
    </SharedSlideUpMenu>
  )
}

export default SnackbarTransactionActivityModal
