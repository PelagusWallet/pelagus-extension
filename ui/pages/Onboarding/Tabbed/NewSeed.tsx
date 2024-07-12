import {
  generateQuaiHDWalletMnemonic,
  importKeyring,
  setKeyringToVerify,
} from "@pelagus/pelagus-background/redux-slices/keyrings"
import React, { ReactElement } from "react"
import {
  Redirect,
  Route,
  Switch,
  useHistory,
  useRouteMatch,
} from "react-router-dom"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
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

  const onVerifySuccess = async (verifiedMnemonic: string[]) => {
    const { success } = (await dispatch(
      importKeyring({
        type: SignerSourceTypes.keyring,
        mnemonic: verifiedMnemonic.join(" "),
        source: SignerImportSource.internal,
        path: selectedNetwork.derivationPath ?? "m/44'/1'/0'/0",
      })
    )) as unknown as AsyncThunkFulfillmentType<typeof importKeyring>

    if (success) {
      dispatch(setKeyringToVerify(null))
      history.push(OnboardingRoutes.ONBOARDING_COMPLETE)
    }
  }

  if (!areKeyringsUnlocked)
    return (
      <Redirect
        to={{
          pathname: OnboardingRoutes.SET_PASSWORD,
          state: { nextPage: path },
        }}
      />
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
          </StepContainer>
        </Route>
      )}
    </Switch>
  )
}
