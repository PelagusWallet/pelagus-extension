import { OneTimeAnalyticsEvent } from "@pelagus/pelagus-background/lib/posthog"
import { sendEvent } from "@pelagus/pelagus-background/redux-slices/ui"
import classNames from "classnames"
import React, { ReactElement, useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import SharedButton from "../../../../components/Shared/SharedButton"
import SharedIcon from "../../../../components/Shared/SharedIcon"
import { useBackgroundDispatch } from "../../../../hooks"
import OnboardingTip from "../OnboardingTip"
import OnboardingRoutes from "../Routes"

type SeedWordWithIndex = {
  wordIndex: number
  word: string
}

type SeedWordPlaceholder = {
  correctWord: string
  selectedWord?: string
  wordIndex: number
  key: string
}

export default function NewSeedVerify({
  onVerify,
  mnemonic,
}: {
  onVerify: (mnemonic: string[]) => void
  mnemonic: string[]
}): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.newWalletVerify",
  })

  const dispatch = useBackgroundDispatch()

  const SEED_WORDS_TO_VERIFY = 8

  const randomIndexes = useMemo(
    () =>
      mnemonic
        .map((_, index) => index)
        .sort(() => Math.random() - 0.5)
        .slice(0, SEED_WORDS_TO_VERIFY),
    [mnemonic]
  )

  const [placeholderList, setPlaceholders] = useState<SeedWordPlaceholder[]>(
    () => {
      const randomSeedWords: SeedWordWithIndex[] = randomIndexes
        .map((index) => ({
          wordIndex: index,
          word: mnemonic[index],
        }))
        .sort(({ wordIndex: a }, { wordIndex: b }) => a - b)

      return randomSeedWords.map(({ wordIndex, word }) => ({
        correctWord: word,
        selectedWord: undefined,
        key: `${word}-${wordIndex}`,
        wordIndex,
      }))
    }
  )

  const [activePlaceholder, setActivePlaceholder] = useState<number>(0)

  const [remainingWords, setRemainingWords] = useState<string[]>(() =>
    randomIndexes.map((index) => mnemonic[index])
  )

  const [submitted, setSubmitted] = useState(false)
  const [isValidSeed, setIsValidSeed] = useState(false)

  const handleVerification = () => {
    const isValid = placeholderList.every(
      ({ correctWord, selectedWord }) => correctWord === selectedWord
    )

    setSubmitted(true)
    setIsValidSeed(isValid)

    if (isValid) {
      dispatch(sendEvent(OneTimeAnalyticsEvent.ONBOARDING_FINISHED))
    }
  }

  const handleAdd = (wordIndex: number) => {
    const position =
      activePlaceholder >= 0
        ? activePlaceholder
        : placeholderList.findIndex((word) => word.selectedWord === undefined)

    if (position >= 0) {
      const newSelectedWords = placeholderList.map((word, index) =>
        index === position
          ? { ...word, selectedWord: remainingWords[wordIndex] }
          : word
      )

      setPlaceholders(newSelectedWords)

      setRemainingWords((words) => words.filter((_, i) => i !== wordIndex))

      const nextActivePlaceholder = newSelectedWords.findIndex(
        (word) => word.selectedWord === undefined
      )

      // Set the next available placeholder as active
      setActivePlaceholder(nextActivePlaceholder)

      if (submitted && nextActivePlaceholder === -1) {
        const isValid = newSelectedWords.every(
          ({ correctWord, selectedWord }) => correctWord === selectedWord
        )

        setIsValidSeed(isValid)
      }
    }
  }

  const handlePlaceholderClick = (position: number): void => {
    if (isValidSeed) return
    const { selectedWord } = placeholderList[position]

    // Clear if placeholder is not empty
    if (selectedWord) {
      setRemainingWords((words) => [...words, selectedWord])

      setPlaceholders((words) =>
        words.map((word, i) =>
          i === position ? { ...word, selectedWord: undefined } : word
        )
      )
    }

    setActivePlaceholder(position)
  }

  return (
    <section className="verify_section fadeIn">
      <h1 className="center_text">{t("title")}</h1>
      <div className="subtitle center_text">{t("subtitle")}</div>
      <div className="words_list">
        {placeholderList.map(({ selectedWord, key, wordIndex }, i) => (
          <div className="word_container" key={key}>
            <span className="number">{wordIndex + 1}.</span>
            <div 
              className={classNames("word_box", {
                "is_filled": selectedWord,
                "is_active": activePlaceholder === i
              })}
              onClick={() => selectedWord ? handlePlaceholderClick(i) : setActivePlaceholder(i)}
            >
              {selectedWord || ""}
            </div>
          </div>
        ))}
      </div>
      <div className="actions">
        {remainingWords?.length === 0 ? (
          <>
            <div className="verify_and_submit">
              {submitted ? (
                <SharedButton
                  type="primary"
                  style={{ 
                    background: "transparent",
                    border: "1px solid #1775E4",
                    width: "100%",
                    maxWidth: "320px",
                    display: "flex",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                  size="medium"
                  isDisabled
                >
                  <span
                    className="valid_status_btn_content"
                    data-is-valid={isValidSeed}
                  >
                    {isValidSeed ? (
                      <>
                        <SharedIcon
                          color="var(--success)"
                          width={24}
                          icon="icons/m/notif-correct.svg"
                        />
                        {t("validState")}
                      </>
                    ) : (
                      <>
                        <SharedIcon
                          color="var(--error)"
                          width={24}
                          icon="icons/m/notif-wrong.svg"
                        />
                        {t("invalidState")}
                      </>
                    )}
                  </span>
                </SharedButton>
              ) : (
                <SharedButton
                  type="primary"
                  size="medium"
                  style={{
                    width: "100%",
                    maxWidth: "320px"
                  }}
                  onClick={handleVerification}
                >
                  {t("verifyValidState")}
                </SharedButton>
              )}

              <SharedButton
                type="primary"
                size="medium"
                style={{
                  width: "100%",
                  maxWidth: "320px",
                  marginTop: "16px"
                }}
                isDisabled={!submitted || !isValidSeed}
                onClick={() => onVerify(mnemonic)}
              >
                {t("submit")}
              </SharedButton>
            </div>
            {submitted && !isValidSeed && (
              <div className="error" style={{ textAlign: "center", color: "#FF4E4E" }}>
                {t("invalidStateMsg")}
              </div>
            )}
          </>
        ) : (
          <div className="word_buttons">
            {remainingWords.map((word, i) => {
              const key = `${word}-${i}`
              return (
                <button
                  type="button"
                  key={key}
                  className="word_button"
                  onClick={() => handleAdd(i)}
                >
                  {word}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <OnboardingTip>
        <Trans
          t={t}
          i18nKey="tip"
          components={{
            url: (
              <Link
                component={({ navigate, children }) => (
                  <span
                    className="reset_seed_link"
                    role="link"
                    tabIndex={0}
                    onKeyUp={navigate}
                    onClick={navigate}
                  >
                    {children}
                  </span>
                )}
                replace
                to={OnboardingRoutes.NEW_SEED}
              />
            ),
          }}
        />
      </OnboardingTip>
      <style jsx>{`
        .verify_section {
          max-width: 450px;
          margin: 0 auto;
        }

        h1 {
          font-family: "Segment";
          font-size: 24px;
          line-height: 32px;
          color: white;
          margin: 0 0 8px 0;
        }

        .subtitle {
          font-family: "Segment";
          font-size: 16px;
          line-height: 24px;
          color: #808080;
          margin: 0 0 24px 0;
        }

        .words_list {
          background: #1C1C1C;
          border-radius: 4px;
          padding: 16px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .word_container {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .number {
          color: white;
          min-width: 24px;
          font-size: 16px;
          line-height: 24px;
          text-align: right;
        }

        .word_box {
          flex: 1;
          height: 40px;
          border: 1px solid #333333;
          border-radius: 4px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          color: white;
          font-size: 16px;
          background: #1C1C1C;
          cursor: pointer;
        }

        .word_box.is_filled {
          background: #1775E4;
          border-color: #1775E4;
          color: white;
        }

        .word_box.is_active {
          border-color: #1775E4;
        }

        .word_buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 24px;
        }

        .word_button {
          background: #1775E4;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          color: white;
          font-size: 16px;
          line-height: 24px;
          cursor: pointer;
        }

        .error {
          color: var(--error);
          margin-top: 8px;
        }

        :global(button[type="submit"]) {
          border-radius: 4px;
        }

        .verify_and_submit {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        .valid_status_btn_content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>
    </section>
  )
}
