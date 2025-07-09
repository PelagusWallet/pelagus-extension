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
import { useIsOnboarding } from "../../../hooks"
import ImportPrivateKeyForm from "./ImportPrivateKeyForm"
import { useTheme } from "../../../hooks/theme-hooks"

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
      <img 
        src="./images/pelagus_title_horizontal.svg" 
        alt="Pelagus" 
        className="header_logo" 
      />
      <style jsx>
        {`
          section {
            display: flex;
            height: 100vh;
            width: 100%;
            justify-content: center;
            align-items: center;
            background-image: linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)),
              url('./images/pelagus_flag_2.png');
            background-size: cover;
            background-position: center;
            position: relative;
          }

          .header_logo {
            position: absolute;
            top: 40px;
            left: 40px;
            height: 32px;
            width: auto;
          }

          .card_container {
            background: var(--primary-bg);
            border-radius: 16px;
            padding: 48px;
            width: 100%;
            max-width: 480px;
            position: relative;
          }

          .back_button {
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 1;
          }

          @media (max-width: 520px) {
            .card_container {
              margin: 16px;
              padding: 32px;
            }

            .header_logo {
              top: 20px;
              left: 20px;
              height: 24px;
            }
          }
        `}
      </style>

      <div className="card_container">
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
    </section>
  )
}

export default function Root(): ReactElement {
  const [isOnboarding] = useState(useIsOnboarding())
  useTheme()

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
