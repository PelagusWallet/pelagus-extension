import React, { ReactElement, useState } from "react"
import { Redirect, useHistory } from "react-router-dom"
import OnboardingRoutes from "./Routes"
import { useAreKeyringsUnlocked } from "../../../hooks"
import { useTranslation } from "react-i18next"
import ImportPrivateKey from "./ImportPrivateKey"
import SharedPanelSwitcher from "../../../components/Shared/SharedPanelSwitcher"
import ImportPrivateKeyJSON from "./ImportPrivateKeyJSON"

type Props = {
  nextPage: string
}
export default function ImportPrivateKeyForm(props: Props): ReactElement {
  const { nextPage } = props

  const areInternalSignersUnlocked = useAreKeyringsUnlocked(false)
  const history = useHistory()

  const [isImporting, setIsImporting] = useState(false)
  const [panelNumber, setPanelNumber] = useState(0)

  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.addWallet.importPrivateKey",
  })

  const finalize = () => history.push(nextPage)

  if (!areInternalSignersUnlocked)
    return (
      <Redirect
        to={{
          pathname: OnboardingRoutes.SET_PASSWORD,
          state: { nextPage: OnboardingRoutes.IMPORT_PRIVATE_KEY },
        }}
      />
    )

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
        <div className="panel_wrapper">
          <SharedPanelSwitcher
            setPanelNumber={setPanelNumber}
            panelNumber={panelNumber}
            panelNames={[t("privateKey"), t("json")]}
          />
        </div>
        {panelNumber === 0 ? (
          <ImportPrivateKey
            setIsImporting={setIsImporting}
            finalize={finalize}
          />
        ) : null}
        {panelNumber === 1 ? (
          <ImportPrivateKeyJSON
            setIsImporting={setIsImporting}
            isImporting={isImporting}
            finalize={finalize}
          />
        ) : null}
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

          .panel_wrapper {
            margin-bottom: 16px;
            --panel-switcher-border: var(--green-80);
            --panel-switcher-primary: #fff;
            --panel-switcher-secondary: var(--green-20);
            width: 100%;
          }
        `}
      </style>
    </section>
  )
}
