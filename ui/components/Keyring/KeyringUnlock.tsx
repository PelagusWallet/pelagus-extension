import React, { ReactElement, useEffect, useState } from "react"
import { useHistory } from "react-router-dom"
import { unlockKeyrings } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { rejectTransactionSignature } from "@pelagus/pelagus-background/redux-slices/transaction-construction"
import { useTranslation } from "react-i18next"
import {
  setShowingAccountsModal,
  setShowingAddAccountModal,
  setSnackbarMessage,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import {
  useBackgroundDispatch,
  useAreKeyringsUnlocked,
  useIsDappPopup,
} from "../../hooks"
import SharedButton from "../Shared/SharedButton"
import PasswordInput from "../Shared/PasswordInput"

type KeyringUnlockProps = {
  displayCancelButton: boolean
}

export default function KeyringUnlock({
  displayCancelButton,
}: KeyringUnlockProps): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "keyring.unlock" })
  const { t: tShared } = useTranslation("translation", { keyPrefix: "shared" })
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [unlockSuccess, setUnlockSuccess] = useState(false)

  const isDappPopup = useIsDappPopup()
  const history: {
    entries?: { pathname: string }[]
    go: (n: number) => void
    goBack: () => void
    replace: (path: string) => void
  } = useHistory()

  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)

  const dispatch = useBackgroundDispatch()

  useEffect(() => {
    if (areKeyringsUnlocked) {
      handleBack()
      dispatch(setSnackbarMessage(t("snackbar")))
    }
  }, [history, areKeyringsUnlocked, dispatch, t, unlockSuccess])

  const dispatchUnlockWallet = async (
    event: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault()
    const { success } = (await dispatch(
      unlockKeyrings(password)
    )) as AsyncThunkFulfillmentType<typeof unlockKeyrings>
    // If keyring was unable to unlock, display error message
    if (!success) {
      setErrorMessage(t("error.incorrect"))
    }
    setUnlockSuccess(success)
  }

  const handleReject = async () => {
    await dispatch(rejectTransactionSignature())
  }

  const handleBack = async () => {
    const ineligiblePaths: string[] = ["/send", "/keyring/unlock"]
    const backPaths = history.entries!.map((entry) => entry.pathname)

    const firstBackPath = backPaths[backPaths.length - 1]

    const targetPath = ineligiblePaths.includes(firstBackPath)
      ? backPaths
          .slice(0, -1)
          .reverse()
          .find((path) => !ineligiblePaths.includes(path))
      : firstBackPath

    history.replace(targetPath || "/")
  }

  const handleCancel = async () => {
    dispatch(setShowingAccountsModal(false))
    dispatch(setShowingAddAccountModal(false))

    await handleReject()

    if (!isDappPopup) handleBack()
  }

  return (
    <section className="standard_width">
      {displayCancelButton ? (
        <div className="cancel_btn_wrap">
          <SharedButton type="tertiaryGray" size="small" onClick={handleCancel}>
            {tShared("cancelBtn")}
          </SharedButton>
        </div>
      ) : (
        <></>
      )}
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
              focusedLabelBackgroundColor="var(--green-95)"
            />
          </div>
          <div>
            <SharedButton type="primary" size="large" isFormSubmit>
              {t("submitBtn")}
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
            background-color: var(--green-95);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
            gap: 16px;
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

          .cancel_btn_wrap {
            width: 100%;
            display: flex;
            justify-content: flex-end;
            right: 0;
            top: 0;
            margin-top: 12px;
          }

          .input_wrap {
            width: 260px;
          }
        `}
      </style>
    </section>
  )
}

KeyringUnlock.defaultProps = {
  displayCancelButton: true,
}
