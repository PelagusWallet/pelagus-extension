import React, { useEffect } from "react"
import { setConvertFrom } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import {
  selectCurrentAccountTotal,
  selectCurrentUtxoAccount,
  selectIsUtxoSelected,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { getExtendedZoneForAddress } from "@pelagus/pelagus-background/services/chain/utils"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedSkeletonLoader from "../../../Shared/SharedSkeletonLoader"
import SharedAccountTab from "../../../Shared/_newDeisgn/accountTab/SharedAccountTab"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"

const ConvertFrom = () => {
  const dispatch = useBackgroundDispatch()

  const isUtxoSelected = useBackgroundSelector(selectIsUtxoSelected)
  const selectedQiAccount = useBackgroundSelector(selectCurrentUtxoAccount)
  const selectedQuaiAccount = useBackgroundSelector(selectCurrentAccountTotal)

  const convertFromAccount = useBackgroundSelector(
    (state) => state.convertAssets.from
  )

  useEffect(() => {
    if (isUtxoSelected && selectedQiAccount) {
      dispatch(setConvertFrom(selectedQiAccount))
      return
    }

    if (selectedQuaiAccount) {
      dispatch(setConvertFrom(selectedQuaiAccount))
    }
  }, [])

  if (!convertFromAccount)
    return (
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontWeight: 500,
            fontSize: "14px",
            lineHeight: "20px",
            color: "var(--secondary-text)",
          }}
        >
          From
        </h3>
        <SharedSkeletonLoader height={66} />
      </section>
    )

  return (
    <>
      <section className="convert-from-wallet">
        <h3 className="convert-from-label">From</h3>
        {isUtxoAccountTypeGuard(convertFromAccount) ? (
          <SharedAccountTab
            account={{
              title: `Cyprus 1 - QI Wallet`,
              subtitle: `${convertFromAccount.paymentCode.slice(
                0,
                10
              )}...${convertFromAccount.paymentCode.slice(-10)}`,
            }}
          />
        ) : (
          <SharedAccountTab
            account={{
              title: `${convertFromAccount?.shortName} - QUAI Account`,
              subtitle: `${getExtendedZoneForAddress(
                convertFromAccount?.address,
                true,
                true
              )} ${convertFromAccount?.shortenedAddress}`,
            }}
            avatarSrc={convertFromAccount?.avatarURL}
            onClick={() => dispatch(setShowingAccountsModal(true))}
          />
        )}
      </section>
      <style jsx>{`
        .convert-from-wallet {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 8px;
        }

        .convert-from-label {
          margin: 0;
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--secondary-text);
        }
      `}</style>
    </>
  )
}

export default ConvertFrom
