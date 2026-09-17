import {
  generateQuaiHDWalletMnemonic,
  importKeyring,
  setKeyringToVerify,
} from "@pelagus/pelagus-background/redux-slices/keyrings"
import React, { ReactElement, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Redirect,
  Route,
  Switch,
  useHistory,
  useRouteMatch,
} from "react-router-dom"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import logger from "@pelagus/pelagus-background/lib/logger"
import { isKeyringLockedError } from "@pelagus/pelagus-background/services/keyring/errors"
import {
  SignerImportSource,
  SignerSourceTypes,
} from "@pelagus/pelagus-background/services/keyring/types"
import OnboardingStepsIndicator from "../../../components/Onboarding/OnboardingStepsIndicator"
import {
  useAreKeyringsUnlocked,
  useBackgroundDispatch,
  useBackgroundSelector,
} from "../../../hooks"
import NewSeedIntro from "./NewSeed/NewSeedIntro"
import NewSeedReview from "./NewSeed/NewSeedReview"
import NewSeedUnlock from "./NewSeed/NewSeedUnlock"
import NewSeedVerify from "./NewSeed/NewSeedVerify"
import OnboardingRoutes from "./Routes"

const StepContainer = ({
  children,
  step,
}: {
  children: React.ReactNode
  step: number
}) => {
  return (
    <div className="steps_section">
      <div className="steps_indicator">
        <OnboardingStepsIndicator activeStep={step} />
      </div>
      {children}
      <style jsx>
        {`
          .steps_section {
            margin: auto;
          }
          .steps_indicator {
            max-width: 200px;
            margin: auto;
          }
        `}
      </style>
    </div>
  )
}

export const NewSeedRoutes = {
  START: OnboardingRoutes.NEW_SEED,
  REVIEW_SEED: `${OnboardingRoutes.NEW_SEED}/new`,
  VERIFY_SEED: `${OnboardingRoutes.NEW_SEED}/verify`,
} as const

export default function NewSeed(): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.newWalletVerify",
  })
  const dispatch = useBackgroundDispatch()
  const mnemonic = useBackgroundSelector(
    (state) => state.keyrings.keyringToVerify?.mnemonic
  )
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)

  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)

  const history = useHistory()
  const { path } = useRouteMatch()

  const showNewSeedPhrase = () => {
    dispatch(generateQuaiHDWalletMnemonic()).then(() =>
      history.push(NewSeedRoutes.REVIEW_SEED)
    )
  }

  const showSeedVerification = () => {
    history.replace(NewSeedRoutes.VERIFY_SEED)
  }

  const [importError, setImportError] = useState("")
  // Held so the import can be retried after the user re-enters their password.
  const [lockedMnemonic, setLockedMnemonic] = useState<string[] | null>(null)

  const finishImport = async (verifiedMnemonic: string[]): Promise<void> => {
    setImportError("")

    try {
      const { success, errorMessage } = (await dispatch(
        importKeyring({
          type: SignerSourceTypes.keyring,
          mnemonic: verifiedMnemonic.join(" "),
          source: SignerImportSource.internal,
          path: selectedNetwork.derivationPath ?? "m/44'/1'/0'/0",
        })
      )) as AsyncThunkFulfillmentType<typeof importKeyring>

      if (success) {
        setLockedMnemonic(null)
        dispatch(setKeyringToVerify(null))
        history.push(OnboardingRoutes.ONBOARDING_COMPLETE)
        return
      }

      if (isKeyringLockedError(errorMessage)) {
        setLockedMnemonic(verifiedMnemonic)
        return
      }

      // The message is background detail; show the localized one and log the
      // rest for support.
      logger.error("Wallet import failed during onboarding:", errorMessage)
      setImportError(t("importFailed"))
    } catch (error) {
      // Includes BACKGROUND_DISCONNECTED_ERROR, which previously hung forever.
      logger.error("Wallet import failed during onboarding:", error)
      setImportError(t("importFailed"))
    }
  }

  const onVerifySuccess = (verifiedMnemonic: string[]) => {
    finishImport(verifiedMnemonic)
  }

  // While a verified phrase is waiting on an unlock, stay put and let
  // NewSeedUnlock recover it rather than restarting onboarding.
  if (!areKeyringsUnlocked && !lockedMnemonic)
    return (
      <Redirect
        to={{
          pathname: OnboardingRoutes.SET_PASSWORD,
          state: { nextPage: path },
        }}
      />
    )

  const errorBanner = importError && (
    <div role="alert" className="import_error">
      {importError}
      <style jsx>{`
        .import_error {
          max-width: 450px;
          margin: 16px auto 0;
          text-align: center;
          color: var(--error);
        }
      `}</style>
    </div>
  )

  // Rendered outside the router: the phrase held here is the only remaining
  // copy once the background has dropped its own, so recovery must not depend
  // on background state still being there.
  if (lockedMnemonic)
    return (
      <StepContainer step={2}>
        <NewSeedUnlock onUnlocked={() => finishImport(lockedMnemonic)} />
        {errorBanner}
      </StepContainer>
    )

  return (
    <Switch>
      <Route path={NewSeedRoutes.START} exact>
        <StepContainer step={0}>
          <NewSeedIntro onAccept={showNewSeedPhrase} />
        </StepContainer>
      </Route>
      {mnemonic && (
        <Route path={NewSeedRoutes.REVIEW_SEED}>
          <StepContainer step={1}>
            <NewSeedReview
              mnemonic={mnemonic}
              onReview={showSeedVerification}
            />
          </StepContainer>
        </Route>
      )}
      {mnemonic && (
        <Route path={NewSeedRoutes.VERIFY_SEED}>
          <StepContainer step={2}>
            <NewSeedVerify mnemonic={mnemonic} onVerify={onVerifySuccess} />
            {errorBanner}
          </StepContainer>
        </Route>
      )}
    </Switch>
  )
}
