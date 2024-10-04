import React from "react"
import SharedAccountTab from "../../../Shared/_newDeisgn/accountTab/SharedAccountTab"
import { setShowingAccountsModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { useBackgroundDispatch } from "../../../../hooks"

const QuaiAccount = () => {
  const dispatch = useBackgroundDispatch()

  return (
    <>
      <div>
        <div className="quai-wallet">
          <p className="quai-wallet-title">Quai Wallet</p>
          <SharedAccountTab
            account={{
              title: "Account 1",
              subtitle: "Cyprus-1 (0x0243...2434)",
            }}
            balance={{ native: "2,231.13 QUAI" }}
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
