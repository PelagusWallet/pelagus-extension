import React from "react"
import GoForwardMenuIcon from "../../../../public/images/_newDesign/GoForwardMenuIcon"
import SharedAccountTab from "../../../Shared/_newDeisgn/accountTab/SharedAccountTab"

const SourceWallet = () => {
  return (
    <>
      <section className="source-wallet">
        <h3 className="source-label">Source Wallet</h3>
        <SharedAccountTab
          account={{
            title: "Cyprus 1 - QI Wallet",
            subtitle: "0x9238...2344",
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
