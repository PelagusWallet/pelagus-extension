import React, { useEffect } from "react"
import {
  selectCurrentAccountTotal,
  selectCurrentNetwork,
  selectCurrentUtxoAccount,
  selectIsUtxoSelected,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { setConvertTo } from "@pelagus/pelagus-background/redux-slices/convertAssets"
import { getExtendedZoneForAddress } from "@pelagus/pelagus-background/services/chain/utils"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedAccountTab from "../../../Shared/_newDeisgn/accountTab/SharedAccountTab"
import SharedSkeletonLoader from "../../../Shared/SharedSkeletonLoader"
import { isUtxoAccountTypeGuard } from "../../../../utils/accounts"
import {
  setSelectedUtxoAccount,
  setShowingAccountsModal,
} from "@pelagus/pelagus-background/redux-slices/ui"

const ConvertTo = () => {
  const dispatch = useBackgroundDispatch()

  const isUtxoSelected = useBackgroundSelector(selectIsUtxoSelected)
  const selectedQiAccount = useBackgroundSelector(selectCurrentUtxoAccount)
  const selectedQuaiAccount = useBackgroundSelector(selectCurrentAccountTotal)

  const currentNetwork = useBackgroundSelector(selectCurrentNetwork)
  const utxoAccountsByPaymentCode = useBackgroundSelector(
    (state) => state.account.accountsData.utxo[currentNetwork.chainID]
  )
  const utxoAccountArr = Object.values(utxoAccountsByPaymentCode ?? {})

  const convertToAccount = useBackgroundSelector(
    (state) => state.convertAssets.to
  )

  useEffect(() => {
    if (isUtxoSelected && selectedQuaiAccount) {
      dispatch(setConvertTo(selectedQuaiAccount))
      return
    }

    if (!selectedQiAccount) {
      dispatch(setSelectedUtxoAccount(utxoAccountArr[0]))
    }

    if (selectedQiAccount) {
      dispatch(setConvertTo(selectedQiAccount))
    }
  }, [selectedQiAccount])

  if (!convertToAccount)
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
          To
        </h3>
        <SharedSkeletonLoader height={66} />
      </section>
    )

  return (
    <>
      <section className="convert-to-wallet">
        <h3 className="convert-to-label">To</h3>
        {isUtxoAccountTypeGuard(convertToAccount) ? (
          <SharedAccountTab
            account={{
              title: `Cyprus 1 - QI Wallet`,
              subtitle: `${convertToAccount.paymentCode.slice(
                0,
                10
              )}...${convertToAccount.paymentCode.slice(-10)}`,
            }}
          />
        ) : (
          <SharedAccountTab
            account={{
              title: `${convertToAccount?.shortName} - QUAI Account`,
              subtitle: `${getExtendedZoneForAddress(
                convertToAccount?.address,
                true,
                true
              )} ${convertToAccount?.shortenedAddress}`,
            }}
            avatarSrc={convertToAccount?.avatarURL}
            onClick={() => dispatch(setShowingAccountsModal(true))}
          />
        )}
      </section>
      <style jsx>{`
        .convert-to-wallet {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 8px;
        }

        .convert-to-label {
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

export default ConvertTo
