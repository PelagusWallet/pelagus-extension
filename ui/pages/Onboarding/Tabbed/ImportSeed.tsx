import React, { ReactElement, useCallback, useState } from "react"
import {
  importKeyring,
  keyringNextPage,
} from "@pelagus/pelagus-background/redux-slices/keyrings"
import { Redirect, useHistory } from "react-router-dom"
import { Mnemonic } from "quais"
import { FeatureFlags, isEnabled } from "@pelagus/pelagus-background/features"
import { useTranslation } from "react-i18next"
import { selectCurrentNetwork } from "@pelagus/pelagus-background/redux-slices/selectors"
import { sendEvent } from "@pelagus/pelagus-background/redux-slices/ui"
import { OneTimeAnalyticsEvent } from "@pelagus/pelagus-background/lib/posthog"
import { langEn } from "@quais/wordlists/lib/lang-en"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import SharedButton from "../../../components/Shared/SharedButton"
import {
  useBackgroundDispatch,
  useBackgroundSelector,
  useAreKeyringsUnlocked,
} from "../../../hooks"
import OnboardingRoutes from "./Routes"
import SharedSelect from "../../../components/Shared/SharedSelect"
import {
  SignerImportSource,
  SignerSourceTypes,
} from "@pelagus/pelagus-background/services/keyring/types"

type Props = {
  nextPage: string
}

export default function ImportSeed(props: Props): ReactElement {
  const { nextPage } = props
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)

  const legacyDerivationPath = "m/44'/60'/0'/0"
  const mainnetDerivationPath = "m/44'/994'/0'/0"
  const testnetDerivationPath = "m/44'/1'/0'/0"
  const selectionOptions = [
    { label: "1", value: testnetDerivationPath },
    { label: "994", value: mainnetDerivationPath },
    { label: "60", value: legacyDerivationPath },
  ]

  const [advancedVisible, setAdvancedVisible] = useState(false)
  const [recoveryPhrase, setRecoveryPhrase] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [path, setPath] = useState<string>(
    selectedNetwork.derivationPath ?? testnetDerivationPath
  )
  const [isImporting, setIsImporting] = useState(false)

  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.addWallet.importSeed",
  })

  const dispatch = useBackgroundDispatch()
  const history = useHistory()

  const importWallet = useCallback(async () => {
    const plainRecoveryPhrase = recoveryPhrase
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
    const splitTrimmedRecoveryPhrase = plainRecoveryPhrase.split(" ")
    if (
      splitTrimmedRecoveryPhrase.length !== 12 &&
      splitTrimmedRecoveryPhrase.length !== 24
    ) {
      setErrorMessage(t("errors.phraseLengthError"))
    } else if (Mnemonic.isValidMnemonic(plainRecoveryPhrase, langEn)) {
      setIsImporting(true)

      const { success } = (await dispatch(
        importKeyring({
          type: SignerSourceTypes.keyring,
          mnemonic: plainRecoveryPhrase,
          path,
          source: SignerImportSource.import,
        })
      )) as unknown as AsyncThunkFulfillmentType<typeof importKeyring>

      if (success) {
        await dispatch(sendEvent(OneTimeAnalyticsEvent.ONBOARDING_FINISHED))
        history.push(nextPage)
      } else {
        setIsImporting(false)
      }
    } else {
      setErrorMessage(t("errors.invalidPhraseError"))
    }
  }, [dispatch, recoveryPhrase, path, t, history, nextPage])

  // FIXME temp fix
  if (!areKeyringsUnlocked) {
    dispatch(keyringNextPage(OnboardingRoutes.IMPORT_SEED))

    return (
      <Redirect
        to={{
          pathname: OnboardingRoutes.SET_PASSWORD,
          state: { nextPage: OnboardingRoutes.IMPORT_SEED },
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
        onSubmit={(event) => {
          event.preventDefault()
          importWallet()
        }}
      >
        <div className="input_wrap">
          <div
            id="recovery_phrase"
            role="textbox"
            aria-labelledby="recovery_label"
            tabIndex={0}
            contentEditable
            data-empty={recoveryPhrase.length < 1}
            spellCheck="false"
            onPaste={(e) => {
              e.preventDefault()
              const text = e.clipboardData.getData("text/plain").trim()
              e.currentTarget.innerText = text
              setRecoveryPhrase(text)
            }}
            onDrop={(e) => {
              e.preventDefault()
              const text = e.dataTransfer.getData("text/plain").trim()
              e.currentTarget.innerText = text
              setRecoveryPhrase(text)
            }}
            onInput={(e) => {
              setRecoveryPhrase(e.currentTarget.innerText.trim())
            }}
          />
          <div id="recovery_label" className="recovery_label">
            {t("inputLabel")}
          </div>
          {errorMessage && <p className="error">{errorMessage}</p>}
        </div>
        <div className="portion bottom">
          <SharedButton
            style={{
              width: "100%",
              maxWidth: "356px",
              boxSizing: "border-box",
            }}
            size={
              isEnabled(FeatureFlags.HIDE_IMPORT_DERIVATION_PATH)
                ? "medium"
                : "large"
            }
            type="primary"
            isDisabled={!recoveryPhrase || isImporting}
            onClick={importWallet}
            center
          >
            {t("submit")}
          </SharedButton>

          <button
            className="advanced-button"
            onClick={() => setAdvancedVisible(!advancedVisible)}
            style={{ marginTop: "5%" }}
            type="button"
          >
            Advanced
          </button>
          {advancedVisible && (
            <SharedSelect
              options={selectionOptions}
              onChange={(newPath) => {
                setPath(newPath)
              }}
              defaultIndex={0}
              label="Choose Cointype"
              width="100%"
              labelColor="white"
              align-self="center"
            />
          )}
          {!isEnabled(FeatureFlags.HIDE_IMPORT_DERIVATION_PATH) && (
            <button
              className="help_button"
              type="button"
              // TODO External link or information modal?
              onClick={() => {}}
            >
              How do I find the recovery phrase?
            </button>
          )}
        </div>
      </form>
      <style jsx>{`
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
        .bottom {
          justify-content: space-between;
          flex-direction: column;
          margin-top: ${isEnabled(FeatureFlags.HIDE_IMPORT_DERIVATION_PATH)
            ? "48px"
            : "24px"};
          margin-bottom: ${isEnabled(FeatureFlags.HIDE_IMPORT_DERIVATION_PATH)
            ? "24px"
            : "16px"};
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
        }

        .info,
        .help_button {
          width: 320px;
          text-align: center;
          font-size: 16px;
          line-height: 24px;
          color: white;
          font-weight: 500;
        }
        .help_button {
          margin-top: 16px;
        }
        .input_wrap {
          position: relative;
        }

        .recovery_label {
          position: absolute;
          font-size: 12px;
          margin-left: 16px;
          line-height: 16px;
          transition: all 0.2s ease-in-out;
          pointer-events: none;
        }

        #recovery_phrase[data-empty="true"]:not(:focus) ~ .recovery_label {
          font-size: 16px;
          line-height: 24px;
          top: 12px;
          color: var(--hunter-green);
          left: 16px;
        }

        #recovery_phrase[data-empty="false"] ~ .recovery_label {
          padding: 0 6px;
          color: var(--green-40);
          background: var(--hunter-green);
          top: -8px;
          left: 16px;
        }

        #recovery_phrase {
          width: 320px;
          height: 104px;
          border-radius: 4px;
          border: 2px solid var(--hunter-green);
          padding: 12px 16px;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: var(--hunter-green);
          font-family: inherit;
          overflow-y: scroll;
        }

        #recovery_phrase * {
          word-wrap: break-word;
          color: var(--white);
          font-family: inherit;
        }

        #recovery_phrase:focus ~ .recovery_label {
          top: -8px;
          left: 16px;
          padding: 0 6px;
          color: var(--trophy-gold);
          background: var(--hunter-green);
          border-radius: 4px;
          transition: all 0.2s ease-in-out;
          z-index: 999;
        }

        #recovery_phrase:focus {
          border: 2px solid var(--trophy-gold);
          outline: 0;
        }

        .error {
          color: red;
        }
      `}</style>
    </section>
  )
}
