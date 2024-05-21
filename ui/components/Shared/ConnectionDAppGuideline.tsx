import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import SharedAccordion from "./SharedAccordion"
import { WalletDefaultToggle } from "../Wallet/WalletToggleDefaultBanner"

interface ConnectionDAppGuidelineProps {
  isConnected: boolean
}

export default function ConnectionDAppGuideline({
  isConnected,
}: ConnectionDAppGuidelineProps): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "topMenu.connectedDappInfo",
  })
  const { t: tShared } = useTranslation("translation", { keyPrefix: "shared" })

  return (
    <>
      <SharedAccordion
        contentHeight={242}
        style={{
          borderRadius: 8,
          marginTop: 8,
          background: "var(--hunter-green)",
          "--panel-switcher-border": "var(--green-80)",
          "--header-padding": "16px",
          "--content-fade-in-duration": "200ms",
          border: "1px solid var(--trophy-gold)",
        }}
        isInitiallyOpen={!isConnected}
        headerElement={<div className="title">{t("guideline.title")}</div>}
        contentElement={
          <div className="content_wrap">
            <div className="panel_wrap">
              <ol className="steps">
                <li>
                  <span className="wallet_toggle_wrap">
                    {t("guideline.step1")}
                    <WalletDefaultToggle />
                  </span>
                </li>
                <li>{t("guideline.step2")}</li>
                <li>{t("guideline.step3")}</li>
              </ol>
              <div className="list_wrap">
                <span className="item">
                  <img src="./images/pelagus_icon_xs.png" alt="Pelagus token" />
                  {tShared("pelagus")}
                </span>
                <span className="item">
                  <img
                    src="./images/icons/s/arrow-right.svg"
                    alt="Arrow right"
                  />
                  {tShared("injected")}
                </span>
                <span className="item">
                  <span className="fox">🦊</span> {tShared("metaMask")}
                </span>
              </div>
            </div>
          </div>
        }
      />
      <style jsx>{`
        .title {
          font-weight: 600;
          font-size: 18px;
          line-height: 24px;
          color: var(--trophy-gold);
        }
        .content_wrap {
          height: 85%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .panel_wrap {
          padding: 0 8px 16px;
        }
        .wallet_connect_info p {
          margin: 0;
          font-size: 16px;
          color: var(--green-40);
          font-family: Segment;
          font-weight: 500;
          line-height: 24px;
          letter-spacing: 0em;
        }
        .wallet_connect_info .learn_more {
          display: flex;
          gap: 16px;
        }

        .wallet_toggle_wrap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .steps {
          margin: 0;
          padding: 0;
          display: flex;
          flex-flow: column;
          list-style: none;
          counter-reset: step;
          color: var(--trophy-gold);
        }
        .steps > li {
          display: flex;
          align-items: start;
          font-weight: 500;
          font-size: 16px;
          line-height: 40px;
        }
        .steps > li::before {
          content: counter(step) ".";
          counter-increment: step;
          padding-right: 4px;
        }
        .list_wrap {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .item img {
          width: 16px;
        }
        .fox {
          font-size: 12px;
        }
        .item {
          font-weight: 500;
          line-height: 24px;
          font-size: 16px;
          display: flex;
          align-items: center;
          color: var(--trophy-gold);
          gap: 4px;
        }
        .item:after {
          content: "/";
          color: var(--trophy-gold);
        }
        .item:last-child:after {
          display: none;
        }
      `}</style>
    </>
  )
}
