import React, { ReactElement } from "react"
import { Redirect, useHistory } from "react-router-dom"
import { keyringNextPage } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { useTranslation } from "react-i18next"
import OnboardingRoutes from "./Routes"
import { useAreKeyringsUnlocked, useBackgroundDispatch } from "../../../hooks"
import ImportPrivateKey from "./ImportPrivateKey"

type Props = {
  nextPage: string
}
export default function ImportPrivateKeyForm(props: Props): ReactElement {
  const { nextPage } = props

  const areInternalSignersUnlocked = useAreKeyringsUnlocked(false)
  const history = useHistory()
  const dispatch = useBackgroundDispatch()

  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.addWallet.importPrivateKey",
  })

  const finalize = () => history.push(nextPage)

  // FIXME temp fix
  if (!areInternalSignersUnlocked) {
    dispatch(keyringNextPage(OnboardingRoutes.IMPORT_PRIVATE_KEY))

    return (
      <Redirect
        to={{
          pathname: OnboardingRoutes.SET_PASSWORD,
          state: { nextPage: OnboardingRoutes.IMPORT_PRIVATE_KEY },
        }}
      />
    )
  }

  return (
    <section className="fadeIn">
      <header className="portion">
        <div className="illustration_import" />
        <h1 className="serif_header">{t("title")}</h1>
        <div className="info">{t("subtitle")}</div>
      </header>
      <form
        className="centered"
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <ImportPrivateKey finalize={finalize} />
      </form>
      <style jsx>
        {`
          form {
            all: unset;
          }

          section {
            max-width: 450px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            flex-direction: column;
            justify-content: space-between;
          }

          h1 {
            margin: unset;
            text-align: center;
          }
          .portion {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .illustration_import {
            background: url("./icon-128.png");
            background-size: cover;
            width: 85px;
            height: 85px;
            margin-bottom: 15px;
            border-radius: 16px;
          }
          .serif_header {
            font-size: 36px;
            line-height: 42px;
            margin-bottom: 8px;
          }
          .info {
            margin-bottom: 40.5px;
            width: 320px;
            text-align: center;
            font-size: 16px;
            line-height: 24px;
            color: white;
            font-weight: 500;
          }
        `}
      </style>
    </section>
  )
}
