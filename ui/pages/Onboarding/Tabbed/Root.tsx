import React, { ReactElement, useState } from "react"

import {
  Route,
  Switch,
  matchPath,
  useLocation,
  Redirect,
} from "react-router-dom"

import classNames from "classnames"

import SharedBackButton from "../../../components/Shared/SharedBackButton"
import AddWallet from "./AddWallet"
import Done from "./Done"
import ImportSeed from "./ImportSeed"
import SetPassword from "./SetPassword"
import NewSeed, { NewSeedRoutes } from "./NewSeed"
import InfoIntro from "./Intro"
import ViewOnlyWallet from "./ViewOnlyWallet"
import OnboardingRoutes from "./Routes"
import RouteBasedContent from "../../../components/Onboarding/RouteBasedContent"
import { useIsOnboarding } from "../../../hooks"
import ImportPrivateKeyForm from "./ImportPrivateKeyForm"

function Navigation({
  children,
  isOnboarding,
}: {
  children: React.ReactNode
  isOnboarding: boolean
}): ReactElement {
  const location = useLocation()

  const ROUTES_WITHOUT_BACK_BUTTON = [
    OnboardingRoutes.ONBOARDING_START,
    OnboardingRoutes.ONBOARDING_COMPLETE,
    NewSeedRoutes.VERIFY_SEED,
    !isOnboarding && OnboardingRoutes.ADD_WALLET,
  ].filter((path): path is Exclude<typeof path, false> => !!path)

  return (
    <section className="onboarding_container">
      <style jsx>
        {`
          section {
            display: flex;
            height: 100%;
            width: 100%;
            justify-content: center;
          }

          .left_container {
            position: relative;
            width: 80%;
            padding-top: 10%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow-y: hidden;
            box-sizing: border-box;
          }

          .left_container.hide {
            display: none;
          }

          .right_container {
            position: relative;
            padding: 10% 80px 0;
            width: 50%;
            max-height: 100vh;
            box-sizing: border-box;
            background: #04141480;
            overflow-y: auto;
          }

          .route_based_content {
            max-width: 400px;
            display: flex;
            flex-direction: column;
            align-items: center;
            flex-grow: 1;
            font-family: "Segment";
            font-style: normal;
            font-weight: 400;
            font-size: 18px;
            line-height: 24px;
            color: var(--green-20);
            text-align: center;
          }

          .onboarding_branding {
            width: 100%;
            max-width: 300px;
            margin: 0 auto 38px;
            padding-bottom: 44px;
            border-bottom: 1px solid var(--green-120);
          }

          .onboarding_logo_branding {
            width: 100%;
            max-width: 300px;
          }

          @media (max-width: 1090px) {
            .right_container {
              padding: 10% 55px 0;
            }
          }

          @media (max-width: 980px) {
            .left_container {
              display: none;
            }

            .right_container {
              width: 100%;
              padding: 10% 80px 0;
            }
          }
        `}
      </style>
      <div
        className={classNames("left_container", { hide: !isOnboarding })}
        style={{
          backgroundImage: `
      linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0)), 
      url('./images/pelagus_flag.png')
    `,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="onboarding_branding">
          <img
            src="./images/logo_onboarding.png"
            alt="Onboarding logo"
            className="onboarding_logo_branding"
          />
        </div>
        <div className="route_based_content">
          <RouteBasedContent />
        </div>
      </div>

      <div className="right_container">
        {!matchPath(location.pathname, {
          path: ROUTES_WITHOUT_BACK_BUTTON,
          exact: true,
        }) && (
          <div className="back_button">
            <SharedBackButton withoutBackText round />
          </div>
        )}
        {children}
      </div>
      <style jsx>{`
        .back_button {
          position: absolute;
          margin-top: 20px;
          z-index: 1;
        }
      `}</style>
    </section>
  )
}

export default function Root(): ReactElement {
  // This prevents navigation "Onboarding" state from changing
  // until this component is unmounted
  const [isOnboarding] = useState(useIsOnboarding())

  return (
    <Navigation isOnboarding={isOnboarding}>
      <Switch>
        {!isOnboarding && (
          <Redirect
            to={OnboardingRoutes.ADD_WALLET}
            from={OnboardingRoutes.ONBOARDING_START}
            exact
          />
        )}
        <Route path={OnboardingRoutes.ONBOARDING_START} exact>
          <InfoIntro />
        </Route>
        <Route path={OnboardingRoutes.ADD_WALLET}>
          <AddWallet />
        </Route>
        <Route path={OnboardingRoutes.SET_PASSWORD}>
          <SetPassword />
        </Route>
        <Route path={OnboardingRoutes.IMPORT_SEED}>
          <ImportSeed nextPage={OnboardingRoutes.ONBOARDING_COMPLETE} />
        </Route>
        <Route path={OnboardingRoutes.IMPORT_PRIVATE_KEY}>
          <ImportPrivateKeyForm
            nextPage={OnboardingRoutes.ONBOARDING_COMPLETE}
          />
        </Route>
        <Route path={OnboardingRoutes.NEW_SEED}>
          <NewSeed />
        </Route>
        <Route path={OnboardingRoutes.VIEW_ONLY_WALLET}>
          <ViewOnlyWallet />
        </Route>
        <Route path={OnboardingRoutes.ONBOARDING_COMPLETE}>
          <Done />
        </Route>
      </Switch>
    </Navigation>
  )
}
