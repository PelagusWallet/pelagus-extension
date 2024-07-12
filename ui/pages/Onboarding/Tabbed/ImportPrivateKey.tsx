import React, { ReactElement, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import { importKeyring } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { SignerSourceTypes } from "@pelagus/pelagus-background/services/keyring/types"
import SharedButton from "../../../components/Shared/SharedButton"
import { useBackgroundDispatch } from "../../../hooks"

type Props = {
  finalize: () => void
}

export default function ImportPrivateKey(props: Props): ReactElement {
  const { finalize } = props

  const dispatch = useBackgroundDispatch()

  const [privateKey, setPrivateKey] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const { t } = useTranslation("translation", {
    keyPrefix: "onboarding.tabbed.addWallet.importPrivateKey",
  })

  const onInputChange = useCallback((pk: string) => {
    setPrivateKey(pk)
    setErrorMessage("")
  }, [])

  const importWallet = useCallback(async () => {
    const trimmedPrivateKey = privateKey.toLowerCase().trim()
    const { success } = (await dispatch(
      importKeyring({
        type: SignerSourceTypes.privateKey,
        privateKey: trimmedPrivateKey,
      })
    )) as unknown as AsyncThunkFulfillmentType<typeof importKeyring>

    if (success) {
      finalize()
    } else {
      setErrorMessage(t("errorImport"))
    }
  }, [dispatch, privateKey, finalize, t])

  return (
    <>
      <div className="input_wrap">
        <div
          id="recovery_phrase"
          role="textbox"
          aria-labelledby={t("inputLabel")}
          tabIndex={0}
          contentEditable
          data-empty={privateKey.length < 1}
          spellCheck="false"
          onPaste={(e) => {
            e.preventDefault()
            const text = e.clipboardData.getData("text/plain").trim()
            e.currentTarget.innerText = text
            onInputChange(text)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const text = e.dataTransfer.getData("text/plain").trim()
            e.currentTarget.innerText = text
            onInputChange(text)
          }}
          onInput={(e) => {
            onInputChange(e.currentTarget.innerText.trim())
          }}
        />
        <div id="recovery_label" className="recovery_label">
          {t("inputLabel")}
        </div>
        {errorMessage && <p className="error">{errorMessage}</p>}
      </div>
      <SharedButton
        style={{ width: "100%", maxWidth: "320px", marginTop: "25px" }}
        size="medium"
        type="primary"
        isDisabled={!privateKey}
        onClick={importWallet}
        center
      >
        {t("submit")}
      </SharedButton>
      <style jsx>
        {`
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
        `}
      </style>
    </>
  )
}
