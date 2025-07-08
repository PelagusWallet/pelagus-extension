import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import { Route, Switch } from "react-router-dom"
import { FaDiscord, FaTwitter } from "react-icons/fa"
import OnboardingRoutes from "../../pages/Onboarding/Tabbed/Routes"
import SharedButton from "../Shared/SharedButton"

export default function RouteBasedContent(): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.routeBasedContent",
  })
  return (
    <Switch>
      <Route key={OnboardingRoutes.NEW_SEED} path={OnboardingRoutes.NEW_SEED}>
        <div className="fadeIn">
          {t("newSeed.tip")}
          <SharedButton
            type="secondary"
            size="medium"
            linkTo={OnboardingRoutes.VIEW_ONLY_WALLET}
          >
            {t("newSeed.action")}
          </SharedButton>
        </div>
        <style jsx>{`
          div {
            display: flex;
            flex-direction: column;
            gap: 16px;
            align-items: center;
          }
        `}</style>
      </Route>
      <Route
        key={OnboardingRoutes.ADD_WALLET}
        path={OnboardingRoutes.ADD_WALLET}
      >
        <div className="fadeIn">{t("addWallet.tip")}</div>
      </Route>
      <Route
        key={OnboardingRoutes.VIEW_ONLY_WALLET}
        path={OnboardingRoutes.VIEW_ONLY_WALLET}
      >
        <div className="fadeIn">{t("viewOnly.tip")}</div>
      </Route>
      <Route
        key={OnboardingRoutes.IMPORT_SEED}
        path={OnboardingRoutes.IMPORT_SEED}
      >
        <div className="fadeIn">{t("importSeed.tip")}</div>
      </Route>
      <Route
        key={OnboardingRoutes.ONBOARDING_COMPLETE}
        path={OnboardingRoutes.ONBOARDING_COMPLETE}
      />
      <Route>
        <div className="onboarding_facts fadeIn">
          <p>{t("default.fact1")}</p>
          <div className="social_container">
            <div className="icon_row">
              <a
                href="https://discord.gg/quai"
                target="_blank"
                rel="noreferrer"
              >
                <FaDiscord size={52} color="white" />
              </a>
              <a
                href="https://twitter.com/QuaiNetwork"
                target="_blank"
                rel="noreferrer"
              >
                <FaTwitter size={52} color="white" />
              </a>
            </div>
            <p>Join the community</p>
          </div>
          <style jsx>{`
            .social_container {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-top: 32px;
            }

            .icon_row {
              display: flex;
              gap: 16px;
              margin-bottom: 12px;
            }

            p {
              font-family: "Segment";
              font-size: 16px;
              line-height: 24px;
              color: var(--secondary-text);
              margin: 0;
            }

            :global(a) {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 52px;
              height: 52px;
              border-radius: 4px;
              background: #1C1C1C;
              transition: opacity 0.2s ease;
            }

            :global(a:hover) {
              opacity: 0.8;
            }

            @media (max-width: 520px) {
              .social_container {
                padding: 0 16px;
              }
            }
          `}</style>
        </div>
      </Route>
    </Switch>
  )
}
