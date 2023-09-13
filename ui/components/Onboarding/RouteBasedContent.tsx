import React from "react"
import { useTranslation } from "react-i18next"
import { Route, Switch } from "react-router-dom"
import OnboardingRoutes from "../../pages/Onboarding/Tabbed/Routes"
import SharedButton from "../Shared/SharedButton"
import WalletShortcut from "./WalletShortcut"
import { FaDiscord, FaTwitter } from 'react-icons/fa';

export default function RouteBasedContent(): JSX.Element {
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
      >
        <div className="fadeIn">
          <WalletShortcut />
        </div>
      </Route>
      <Route>
        <div className="onboarding_facts fadeIn">
          <p>{t("default.fact1")}</p>
          <div className="community_links">
            <div className="icon_row">
              <a href="https://discord.gg/quai" target="_blank" rel="noreferrer">
                <FaDiscord size={52} color="white" />
              </a>
              <a href="https://twitter.com/QuaiNetwork" target="_blank" rel="noreferrer">
                <FaTwitter size={52} color="white"/>
              </a>
            </div>
            <p>Join the community</p>
          </div>
          <style jsx>
            {`
              .onboarding_facts {
                color: var(--hunter-green);
                display: flex;
                flex-direction: column;
                justify-content: center;
                gap: 24px;
              }

              .onboarding_facts p {
                color: var(--hunter-green);
                margin: 0;
                text-align: center;
                font-size: 24px;
                line-height: 24px;
              }

              .community_links {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
              }

              .icon_row {
                display: flex;
                flex-direction: row;
                gap: 16px;
              }
            `}
          </style>
        </div>
      </Route>

    </Switch>
  )
}
