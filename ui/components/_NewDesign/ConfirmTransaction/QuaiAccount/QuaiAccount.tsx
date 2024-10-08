import React, { useEffect } from "react"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { getExtendedZoneForAddress } from "@pelagus/pelagus-background/services/chain/utils"
import { ACCOUNT_TYPES } from "@pelagus/pelagus-background/redux-slices/accounts"
import { selectCurrentNetworkAccountTotalsByCategory } from "@pelagus/pelagus-background/redux-slices/selectors"
import { setQiSendQuaiAcc } from "@pelagus/pelagus-background/redux-slices/qiSend"
import SharedAccountTab from "../../../Shared/_newDeisgn/accountTab/SharedAccountTab"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedSkeletonLoader from "../../../Shared/SharedSkeletonLoader"

const QuaiAccount = () => {
  const dispatch = useBackgroundDispatch()

  const accountTotals = useBackgroundSelector(
    selectCurrentNetworkAccountTotalsByCategory
  )

  const quiAccount = useBackgroundSelector(
    (state) => state.qiSend.senderQuaiAccount
  )

  useEffect(() => {
    ACCOUNT_TYPES.forEach((accountType) => {
      const accountTypeTotals = accountTotals[accountType]
      if (accountTypeTotals && accountTypeTotals.length && !quiAccount) {
        dispatch(setQiSendQuaiAcc(accountTypeTotals[0]))
      }
    })
  }, [])

  if (!quiAccount)
    return (
      <div className="quai-wallet">
        <p className="quai-wallet-title">Quai Wallet</p>
        <SharedSkeletonLoader height={66} />
      </div>
    )

  const { shortenedAddress, shortName, balance, address, avatarURL } =
    quiAccount

  const zone = getExtendedZoneForAddress(address, true, true)

  return (
    <>
      <div>
        <div className="quai-wallet">
          <p className="quai-wallet-title">Quai Wallet</p>
          <SharedAccountTab
            account={{
              title: shortName,
              subtitle: `${zone} (${shortenedAddress})`,
            }}
            balance={{ native: `${balance}` }}
            avatarSrc={avatarURL}
            onClick={() => dispatch(setShowingAccountsModal(true))}
          />
        </div>
      </div>

      <style jsx>{`
        .quai-wallet-title {
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--secondary-text);
          margin: 0 0 8px;
        }
      `}</style>
    </>
  )
}

export default QuaiAccount
