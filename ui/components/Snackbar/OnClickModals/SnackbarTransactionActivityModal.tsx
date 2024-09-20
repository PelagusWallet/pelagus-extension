import React, { Dispatch, SetStateAction } from "react"
import {
  resetSnackbarConfig,
  setShowingActivityDetail,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { useDispatch } from "react-redux"
import {
  selectCurrentAccount,
  selectShowingActivityDetail,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import WalletActivityDetails from "../../Wallet/WalletActivityDetails"
import SharedSlideUpMenu from "../../Shared/SharedSlideUpMenu"
import { useBackgroundSelector } from "../../../hooks"

const SnackbarTransactionActivityModal = ({
  setIsOpenActivityDetails,
}: {
  setIsOpenActivityDetails: Dispatch<SetStateAction<boolean>>
}) => {
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
        setIsOpenActivityDetails(false)
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
