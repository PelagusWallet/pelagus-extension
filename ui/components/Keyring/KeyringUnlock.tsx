import React, { ReactElement, useEffect, useState } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { unlockKeyrings } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { useTranslation } from "react-i18next"
import { useBackgroundDispatch, useAreKeyringsUnlocked } from "../../hooks"
import SharedButton from "../Shared/SharedButton"
import PasswordInput from "../Shared/PasswordInput"

export default function KeyringUnlock(): ReactElement {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()
  const location = useLocation()
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const { t } = useTranslation("translation", { keyPrefix: "keyring.unlock" })

  const redirectPath = (location.state as any)?.from || "/"
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (areKeyringsUnlocked) {
      history.replace(redirectPath)
    }
  }, [areKeyringsUnlocked, redirectPath, history])

  const dispatchUnlockWallet = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    const { success } = await dispatch(unlockKeyrings(password))
    if (!success) {
      setErrorMessage(t("error.incorrect"))
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

          .input_wrap {
            width: 260px;
          }
        `}
      </style>
    </section>
  )
}
