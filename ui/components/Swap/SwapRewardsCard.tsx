import React, { ReactElement } from "react"
import { WEBSITE_ORIGIN } from "@pelagus/pelagus-background/constants/website"
import { useTranslation } from "react-i18next"
import SharedTooltip from "../Shared/SharedTooltip"

export default function SwapRewardsCard(): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "swap.rewards" })
  return (
    <div className="container">
      <div className="image" />
      <div>
        <h5 className="header">{t("header")}</h5>
        <p className="text">
          {t("body")}
          <span className="tooltip_inline_wrap">
            <SharedTooltip width={150} verticalPosition="top">
              <p className="tooltip">{t("tooltip")}</p>
              <a
                href={`${WEBSITE_ORIGIN}/rewards`}
                target="_blank"
                rel="noreferrer"
                className="details"
              >
                {t("detailButton")}
                <div className="details_icon" />
              </a>
            </SharedTooltip>
          </span>
        </p>
      </div>
      <style jsx>{`
        .container {
          padding: 8px 8px 16px;
          padding-left: 13px;
          border: 1px solid var(--link);
          border-radius: 4px;
          display: flex;
        }
        .image {
          background-image: url("./images/stars.svg");
          background-size: contain;
          width: 24px;
          height: 24px;
          margin-right: 10px;
          flex-shrink: 0;
        }
        .header {
          font-size: 16px;
          line-height: 24px;
          font-weight: 500;
          margin: 0 0 8px;
        }
        .text {
          font-size: 14px;
          line-height: 20px;
          color: var(--green-40);
          margin: 0;
        }
        .tooltip {
          margin: 0;
        }
        .details {
          color: var(--hunter-green);
          font-size: 16px;
          font-weight: 500;
          display: flex;
          align-items: center;
          margin-top: 5px;
        }
        .details_icon {
          mask-image: url("./images/new_tab@2x.png");
          mask-size: cover;
          width: 16px;
          height: 16px;
          background-color: var(--hunter-green);
          margin-left: 5px;
        }
        .tooltip_inline_wrap {
          display: inline-block;
          vertical-align: middle;
        }
      `}</style>
    </div>
  )
}
