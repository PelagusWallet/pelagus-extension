import { unlockKeyrings } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import React, { ReactElement, useState } from "react"
import { useTranslation } from "react-i18next"
import PasswordInput from "../../../../components/Shared/PasswordInput"
import SharedButton from "../../../../components/Shared/SharedButton"
import { useBackgroundDispatch } from "../../../../hooks"

/**
 * Shown when the vault locked itself before the recovery phrase could be
 * imported — normally because the background service worker was terminated
 * while the user wrote their phrase down. The phrase is still valid, so the
 * import is retried after the password is re-entered.
 */
export default function NewSeedUnlock({
  onUnlocked,
}: {
  onUnlocked: () => void
}): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.newWalletVerify",
  })
  const { t: tShared } = useTranslation()
  const dispatch = useBackgroundDispatch()

  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isUnlocking, setIsUnlocking] = useState(false)

  const unlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage("")
    setIsUnlocking(true)

    try {
      const { success } = (await dispatch(
        unlockKeyrings(password)
      )) as AsyncThunkFulfillmentType<typeof unlockKeyrings>

      if (success) {
        setPassword("")
        // Leave the button busy: the parent resumes the import from here.
        onUnlocked()
        return
      }

      setErrorMessage(tShared("keyring.unlock.error.incorrect"))
    } catch {
      // Not a wrong password: the background could not be reached.
      setErrorMessage(t("importFailed"))
    }

    setIsUnlocking(false)
  }

  return (
    <form className="unlock_section" onSubmit={unlock}>
      <h1 className="center_text">{t("sessionExpiredTitle")}</h1>
      <div className="subtitle center_text">{t("sessionExpiredSubtitle")}</div>
      <PasswordInput
        id="onboarding_unlock_password"
        label={tShared("keyring.unlock.signingPassword")}
        value={password}
        onChange={(value) => {
          setPassword(value ?? "")
          setErrorMessage("")
        }}
        errorMessage={errorMessage}
        focusedLabelBackgroundColor="var(--hunter-green)"
      />
      <SharedButton
        type="primary"
        size="medium"
        isFormSubmit
        isDisabled={password.length === 0 || isUnlocking}
        isLoading={isUnlocking}
      >
        {t("unlockCta")}
      </SharedButton>
      <style jsx>{`
        .unlock_section {
          max-width: 450px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        h1 {
          font-family: "Segment";
          font-size: 24px;
          line-height: 32px;
          color: white;
          margin: 0;
        }
        .subtitle {
          font-family: "Segment";
          font-size: 16px;
          line-height: 24px;
          color: #808080;
        }
      `}</style>
    </form>
  )
}
