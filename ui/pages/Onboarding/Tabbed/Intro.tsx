import { OneTimeAnalyticsEvent } from "@pelagus/pelagus-background/lib/posthog"
import { sendEvent } from "@pelagus/pelagus-background/redux-slices/ui"
import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import SharedButton from "../../../components/Shared/SharedButton"
import { useBackgroundDispatch } from "../../../hooks"
import OnboardingRoutes from "./Routes"

export default function Intro(): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.intro",
  })
  const dispatch = useBackgroundDispatch()

  return (
    <section className="intro_section fadeIn">
      <img src="./images/pelagus_title_vertical_grey.svg" alt="Pelagus" className="logo" />
      <h1 className="title">Raise your sails, matey!</h1>
      <p className="description">
        Pelagus Wallet, the first open source web wallet for Quai Network.
      </p>
      <div className="button_container">
        <SharedButton
          type="secondary"
          size="large"
          linkTo={OnboardingRoutes.ADD_WALLET}
          onClick={() =>
            dispatch(sendEvent(OneTimeAnalyticsEvent.ONBOARDING_STARTED))
          }
          center
        >
          {t("useExisting")}
        </SharedButton>
        <SharedButton
          type="primary"
          size="large"
          linkTo={OnboardingRoutes.NEW_SEED}
          onClick={() =>
            dispatch(sendEvent(OneTimeAnalyticsEvent.ONBOARDING_STARTED))
          }
          center
        >
          {t("createNew")}
        </SharedButton>
      </div>
      <style jsx>
        {`
          .intro_section {
            width: 100%;
            max-width: 480px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            --fade-in-duration: 300ms;
          }

          .logo {
            width: 192px;
            height: 192px;
            margin-bottom: 24px;
          }

          .title {
            font-family: "Segment";
            font-size: 24px;
            line-height: 32px;
            color: #FFFFFF;
            margin: 0 0 12px 0;
          }

          .description {
            font-family: "Segment";
            font-size: 16px;
            line-height: 24px;
            color: #808080;
            margin: 0 0 32px 0;
          }

          .button_container {
            display: flex;
            gap: 16px;
            width: 100%;
            justify-content: space-between;
          }

          .button_container > :global(button) {
            flex: 1 1 0;
            border-radius: 4px !important;
          }

          @media (max-width: 520px) {
            .intro_section {
              padding: 0 16px;
            }
          }
        `}
      </style>
    </section>
  )
}
