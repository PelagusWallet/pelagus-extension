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
import { useBackgroundSelector } from "../../../hooks"
import SharedModalHeaders from "../../Shared/_newDeisgn/modalWrapper/SharedModalHeaders"
import SharedModalWrapper from "../../Shared/_newDeisgn/modalWrapper/SharedModalWrapper"

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

  const handleClose = async () => {
    dispatch(setShowingActivityDetail(null))
    dispatch(resetSnackbarConfig())
    setIsOpenActivityDetails(false)
  }

  return (
    <SharedModalWrapper
      footer={<></>}
      header={
        <SharedModalHeaders
          title="Review Transaction"
          onClose={handleClose}
          withGoBackIcon={false}
        />
      }
      isOpen={!!showingActivityDetail}
      onClose={handleClose}
      customStyles={{ alignItems: "flex-end" }}
    >
      {showingActivityDetail && (
        <WalletActivityDetails
          activityItem={showingActivityDetail}
          activityInitiatorAddress={currentAddress}
        />
      )}
    </SharedModalWrapper>
  )
}

export default SnackbarTransactionActivityModal
