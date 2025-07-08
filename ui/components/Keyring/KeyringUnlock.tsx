import React, { ReactElement, useEffect, useState } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { unlockKeyrings } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { useTranslation } from "react-i18next"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import { useBackgroundDispatch, useAreKeyringsUnlocked } from "../../hooks"
import SharedButton from "../Shared/SharedButton"
import PasswordInput from "../Shared/PasswordInput"
import SharedProgressBar from "../Shared/SharedProgressBar"

export default function KeyringUnlock(): ReactElement {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const location = useLocation()
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const { t } = useTranslation("translation", { keyPrefix: "keyring.unlock" })

  const redirectPath = (location.state as any)?.from || "/"
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockProgress, setUnlockProgress] = useState(0)
  const [unlockSuccess, setUnlockSuccess] = useState(false)

  useEffect(() => {
    let navigationTimeout: NodeJS.Timeout
    if (areKeyringsUnlocked && unlockProgress === 100) {
      // Add a small delay to ensure the progress bar animation is visible
      navigationTimeout = setTimeout(() => {
        history.replace(redirectPath)
      }, 400) // Matches the transition time in SharedProgressBar
    }
    return () => clearTimeout(navigationTimeout)
  }, [areKeyringsUnlocked, unlockProgress, redirectPath, history])

  // Simulated progress effect when unlocking
  useEffect(() => {
    let progressInterval: NodeJS.Timeout
    let quickProgress: NodeJS.Timeout

    if (isUnlocking) {
      // Start with quick progress up to 70%
      quickProgress = setInterval(() => {
        setUnlockProgress((prev) => {
          if (prev < 70) {
            return prev + 5
          }
          clearInterval(quickProgress)
          return prev
        })
      }, 50)

      // Then slow down the progress
      progressInterval = setInterval(() => {
        setUnlockProgress((prev) => {
          if (prev < 90) return prev + 1
          if (unlockSuccess) return 100
          clearInterval(progressInterval)
          return prev
        })
      }, 100)
    } else {
      setUnlockProgress(0)
    }

    return () => {
      clearInterval(progressInterval)
      clearInterval(quickProgress)
    }
  }, [isUnlocking, unlockSuccess])

  const dispatchUnlockWallet = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setIsUnlocking(true)
    setUnlockSuccess(false)

    const { success } = (await dispatch(
      unlockKeyrings(password)
    )) as AsyncThunkFulfillmentType<typeof unlockKeyrings>

    if (!success) {
      setIsUnlocking(false)
      setErrorMessage(t("error.incorrect"))
    } else {
      setUnlockSuccess(true)
      // Progress bar will automatically go to 100% due to unlockSuccess state
    }
  }

  return (
    <section className="standard_width">
      <div className="img_wrap">
        <div className="illustration_unlock" />
      </div>
      <h1 className="serif_header" style={{ color: "var(--trophy-gold" }}>
        {t("title")}
      </h1>
      <div className="simple_text subtitle">{t("subtitle")}</div>
      <form onSubmit={dispatchUnlockWallet}>
        <div className="signing_wrap">
          <div className="input_wrap">
            <PasswordInput
              id="signing_password"
              label={t("signingPassword")}
              onChange={(value) => {
                setPassword(value)
                setErrorMessage("")
              }}
              errorMessage={errorMessage}
              focusedLabelBackgroundColor="var(--secondary-bg)"
            />
          </div>
          {isUnlocking && (
            <div className="progress_container">
              <SharedProgressBar progress={unlockProgress} height={4} />
              <div className="progress_text">
                Decrypting Wallets... {unlockProgress}%
              </div>
            </div>
          )}
          <div>
            <SharedButton
              type="primary"
              size="large"
              isFormSubmit
              isDisabled={isUnlocking}
            >
              {isUnlocking ? "Unlocking..." : t("submitBtn")}
            </SharedButton>
          </div>
        </div>
      </form>
      <style jsx>
        {`
          .illustration_unlock {
            background: url("./images/pelagus_unlock.png") no-repeat center;
            background-size: contain;
            width: 90px;
            height: 172.18px;
          }

          section {
            background-color: var(--secondary-bg);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            gap: 16px;
            padding-top: 40px;
          }

          .subtitle {
            width: 55%;
            text-align: center;
            box-sizing: border-box;
          }

          form {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
          }

          .signing_wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 30px;
          }

          .input_wrap {
            width: 260px;
          }

          .progress_container {
            width: 260px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .progress_text {
            font-size: 12px;
            color: var(--secondary-text);
            text-align: center;
          }
        `}
      </style>
    </section>
  )
}
