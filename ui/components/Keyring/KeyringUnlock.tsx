import React, { ReactElement, useEffect, useState } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { unlockKeyrings } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { useTranslation } from "react-i18next"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import { useBackgroundDispatch, useAreKeyringsUnlocked } from "../../hooks"
import SharedButton from "../Shared/SharedButton"
import PasswordInput from "../Shared/PasswordInput"
import SharedProgressBar from "../Shared/SharedProgressBar"
import LanguageModal from "../Shared/LanguageModal"
import { getLanguage } from "../../_locales/i18n"

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
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false)

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
    } else if (unlockSuccess) {
      // Only reset progress to 0 when successfully unlocked
      setUnlockProgress(0)
    }
    // Don't reset progress when isUnlocking becomes false due to error

    return () => {
      clearInterval(progressInterval)
      clearInterval(quickProgress)
    }
  }, [isUnlocking, unlockSuccess])

  const dispatchUnlockWallet = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    
    // Check if field is not empty
    if (!password.trim()) {
      setErrorMessage(t("error.pleaseEnterPassword"))
      return
    }
    
    // Clear previous error when starting new check
    setErrorMessage("")
    setIsUnlocking(true)
    setUnlockSuccess(false)

    // Start timing for minimum delay
    const startTime = Date.now()
    const minDelay = 1500 // 1.5 seconds minimum delay

    const { success } = (await dispatch(
      unlockKeyrings(password)
    )) as AsyncThunkFulfillmentType<typeof unlockKeyrings>

    // Calculate elapsed time
    const elapsedTime = Date.now() - startTime
    const remainingDelay = Math.max(0, minDelay - elapsedTime)

    // Wait for remaining time if needed
    if (remainingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay))
    }

    if (!success) {
      // Stop progress at current value instead of resetting to 0
      setIsUnlocking(false)
      // Small delay before showing error so loader can disappear
      setTimeout(() => {
        setErrorMessage(t("error.incorrect"))
        // Reset progress after showing error
        setUnlockProgress(0)
      }, 300)
    } else {
      setUnlockSuccess(true)
      // Progress bar will automatically go to 100% due to unlockSuccess state
    }
  }

  return (
    <section className="standard_width">
      <div className="header_section">
        <div className="img_wrap">
          <div className="illustration_unlock" />
        </div>
        <h1 className="serif_header" style={{ 
          color: "var(--trophy-gold)",
          fontSize: "34px"
        }}>
          {t("title")}
        </h1>
        <div className="simple_text subtitle">{t("subtitle")}</div>
      </div>
      
      <div className="content_section">
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
                focusedLabelBackgroundColor="var(--green-95)"
              />
            </div>
            <div className={`progress_container ${isUnlocking ? 'show' : 'hide'}`}>
              <SharedProgressBar progress={unlockProgress} height={4} />
              <div className="progress_text">
                Decrypting Wallets... {unlockProgress}%
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="custom_unlock_button"
                disabled={isUnlocking}
              >
                {isUnlocking ? t("unlocking") : t("submitBtn")}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      <div className="bottom_links">
        <button 
          className="language_link"
          onClick={() => setIsLanguageModalOpen(true)}
        >
          {t("selectLanguage")}
        </button>
        <button 
          className="community_link"
          onClick={() => window.open("https://discord.gg/quai", "_blank")}
        >
          {t("joinCommunity")}
        </button>
      </div>
      
      <LanguageModal 
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
      />
      <style jsx>
        {`
          .illustration_unlock {
            background: url("./Pelagus_Wallet_Logo_Blue.png") no-repeat center;
            background-size: contain;
            width: 120px;
            height: 120px;
          }

          section {
            background: linear-gradient(180deg, #f8faff 0%, #ffffff 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            padding: 40px 20px;
            position: relative;
            box-sizing: border-box;
          }

          .header_section {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            margin-bottom: 40px;
          }

          .content_section {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 32px;
            width: 100%;
          }

          .subtitle {
            width: 100%;
            max-width: 280px;
            text-align: center;
            box-sizing: border-box;
            color: var(--green-40);
          }

          .bottom_links {
            position: absolute;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 46px;
          }

          .community_link,
          .language_link {
            background: none;
            border: none;
            color: var(--green-60);
            font-size: 11px;
            font-weight: 400;
            cursor: pointer;
            text-decoration: none;
            transition: color 0.2s;
            opacity: 0.7;
            white-space: nowrap;
          }

          .community_link:hover,
          .language_link:hover {
            color: var(--green-40);
            opacity: 1;
          }

          .custom_unlock_button {
            height: 56px;
            border-radius: 8px;
            background: linear-gradient(135deg, rgba(21, 104, 229, 0.8) 0%, rgba(13, 75, 179, 0.8) 100%);
            border: none;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            padding: 0 32px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 25px rgba(21, 104, 229, 0.2);
            transition: all 0.3s ease;
            margin-top: 16px;
          }

          .custom_unlock_button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: left 0.6s ease;
            z-index: 1;
          }

          .custom_unlock_button:hover {
            box-shadow: 0 12px 35px rgba(21, 104, 229, 0.4);
          }

          .custom_unlock_button:hover::before {
            left: 100%;
          }

          .custom_unlock_button:active {
            box-shadow: 0 6px 20px rgba(21, 104, 229, 0.3);
          }

          .custom_unlock_button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }

          form {
            display: flex;
            justify-content: center;
            width: 100%;
          }

          .signing_wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }

          .input_wrap {
            width: 260px;
          }

          .progress_container {
            width: 260px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: -8px;
            transition: all 0.3s ease;
            overflow: hidden;
          }

          .progress_container.hide {
            max-height: 0;
            opacity: 0;
            margin-bottom: 0;
          }

          .progress_container.show {
            max-height: 60px;
            opacity: 1;
            margin-bottom: -8px;
          }

          .progress_text {
            font-size: 12px;
            color: var(--green-40);
            text-align: center;
          }
        `}
      </style>
    </section>
  )
}
