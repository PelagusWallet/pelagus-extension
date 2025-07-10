import { setSnackbarConfig } from "@pelagus/pelagus-background/redux-slices/ui"
import React, { ReactElement } from "react"
import { useTranslation } from "react-i18next"
import SharedButton from "../../../../components/Shared/SharedButton"
import { useBackgroundDispatch } from "../../../../hooks"
import SharedBanner from "../../../../components/Shared/SharedBanner"
import { addToOffscreenClipboardSensitiveData } from "../../../../../src/offscreen"

export default function NewSeedReview({
  onReview,
  mnemonic,
}: {
  mnemonic: string[]
  onReview: () => void
}): ReactElement {
  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.newWalletReview",
  })
  const { t: sharedT } = useTranslation("translation", {
    keyPrefix: "shared",
  })
  const dispatch = useBackgroundDispatch()

  const onCopyMnemonic = async () => {
    await addToOffscreenClipboardSensitiveData(mnemonic?.join(" ") ?? "")
    dispatch(setSnackbarConfig({ message: sharedT("copyTextSnackbar") }))
  }

  return (
    <section className="fadeIn">
      <div className="warning_banner">
        <img 
          src="./images/material-symbols_warning-outline.png" 
          alt="warning" 
          className="warning_icon"
        />
        <p>
          Keep this recovery phrase confidential. Anyone who has it can steal your funds or steal your wallet funds.
        </p>
      </div>

      <div className="content">
        <h1>Secret recovery phrase</h1>
        <div className="seed_phrase">
          {mnemonic.map((word, i) => (
            <div className="word" key={`${word}-${i}`}>
              <span className="number">{i + 1}.</span>
              <span className="text">{word}</span>
            </div>
          ))}
        </div>

        <div className="copy_button_container">
        <div className="copy_phrase">
          <SharedButton
            type="tertiary"
            size="small"
            iconMedium="copy"
            onClick={onCopyMnemonic}
            center
          >
            {t("copyAddressAction")}
          </SharedButton>
        </div>
        </div>

        <SharedButton 
          type="primary" 
          size="large" 
          onClick={onReview}
          center
        >
          Next
        </SharedButton>
      </div>

      <style jsx>{`
        section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .warning_banner {
          background: rgba(33, 150, 243, 0.1);
          border: 1px solid #2196F3;
          border-radius: 4px;
          padding: 16px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .warning_icon {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        .warning_banner p {
          margin: 0;
          color: white;
          font-size: 16px;
          line-height: 24px;
        }

        .content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        h1 {
          font-family: "Segment";
          font-size: 24px;
          line-height: 32px;
          color: white;
          margin: 0;
          text-align: center;
        }

        .seed_phrase {
          background: #1C1C1C;
          border-radius: 4px;
          padding: 16px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .word {
          display: flex;
          gap: 8px;
          align-items: center;
          color: white;
          font-size: 16px;
          line-height: 24px;
        }

        .number {
          color: #808080;
        }

        .copy_button_container {
          display: flex;
          justify-content: center;
        }

        .copy_button {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          color: #2196F3;
          font-size: 16px;
          line-height: 24px;
          cursor: pointer;
          padding: 0;
        }

        .copy_button img {
          width: 20px;
          height: 20px;
          filter: invert(48%) sepia(57%) saturate(2793%) hue-rotate(190deg) brightness(97%) contrast(95%);
        }

        .checkbox_container {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          cursor: pointer;
        }

        .checkbox_text {
          color: #808080;
          font-size: 14px;
          line-height: 20px;
        }

        :global(button[type="submit"]) {
          border-radius: 4px;
        }

        .warning_message {
          font-size: 14px;
          line-height: 18px;
          font-weight: 500;
        }
      `}</style>
    </section>
  )
}
