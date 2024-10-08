import React, { useEffect } from "react"
import { setQiSendAcc } from "@pelagus/pelagus-background/redux-slices/qiSend"
import SharedAccountTab from "../../../Shared/_newDeisgn/accountTab/SharedAccountTab"
import { useBackgroundDispatch, useBackgroundSelector } from "../../../../hooks"
import SharedSkeletonLoader from "../../../Shared/SharedSkeletonLoader"

const SourceWallet = () => {
  const dispatch = useBackgroundDispatch()
  const qiHdWallet = useBackgroundSelector((state) => state.keyrings.qiHDWallet)

  const qiSendAccount = useBackgroundSelector(
    (state) => state.qiSend.senderQiAccount
  )

  useEffect(() => {
    if (qiSendAccount) return
    dispatch(setQiSendAcc(qiHdWallet))
  }, [])

  if (!qiSendAccount)
    return (
      <section className="source-wallet">
        <h3 className="source-label">Source Wallet</h3>
        <SharedSkeletonLoader height={66} />
      </section>
    )

  const { paymentCode } = qiSendAccount

  return (
    <>
      <section className="source-wallet">
        <h3 className="source-label">Source Wallet</h3>
        <SharedAccountTab
          account={{
            title: `Cyprus 1 - QI Wallet`,
            subtitle: `${paymentCode.slice(0, 10)}...${paymentCode.slice(-10)}`,
          }}
        />
      </section>
      <style jsx>{`
        .source-wallet {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
        }

        .source-label {
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

export default SourceWallet
