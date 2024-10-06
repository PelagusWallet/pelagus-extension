import React from "react"
import GoForwardMenuIcon from "../iconComponents/GoForwardMenuIcon"

const SharedAccountTab = ({
  account = { title: "", subtitle: "" },
  balance = { native: "", usd: "" },
  avatarSrc = "./images/avatars/compass@2x.png",
  onClick = () => {},
}: {
  account?: { title?: string; subtitle?: string }
  balance?: { native?: string; usd?: string }
  avatarSrc?: string
  onClick?: () => void
}) => {
  return (
    <>
      <article className="wallet-wrapper" onClick={onClick}>
        <div className="wallet-info">
          <img src={avatarSrc} alt="avatar" className="wallet-avatar" />
          <div>
            <div className="wallet-name">{account.title}</div>
            <div className="wallet-address">{account.subtitle}</div>
          </div>
        </div>
        <div>
          <div className="wallet-balance-native">{balance.native}</div>
          <div className="wallet-balance-usd">{balance.usd}</div>
        </div>
        <GoForwardMenuIcon />
      </article>
      <style jsx>{`
        .wallet-wrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border: 2px solid var(--tertiary-bg);
          border-radius: 8px;
          cursor: pointer;
        }

        .wallet-wrapper:hover {
          border-color: var(--accent-color);
        }

        .wallet-info {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .wallet-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--secondary-bg);
        }

        .wallet-name,
        .wallet-balance-native {
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          color: var(--primary-text);
        }

        .wallet-balance-native {
          font-size: 12px;
          line-height: 18px;
        }

        .wallet-address,
        .wallet-balance-usd {
          font-weight: 500;
          font-size: 12px;
          line-height: 18px;
          color: var(--secondary-text);
        }
      `}</style>
    </>
  )
}

export default SharedAccountTab
