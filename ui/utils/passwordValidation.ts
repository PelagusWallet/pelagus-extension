import i18next from "i18next"

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 20

const PASSWORD_REGEX = /^[A-Za-z0-9!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~]+$/

export const validatePassword = (
  password: string,
  passwordConfirmation: string,
  setPasswordErrorMessage: (value: React.SetStateAction<string>) => void
): boolean => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    setPasswordErrorMessage(
      i18next.t("keyring.setPassword.error.characterCount")
    )
    return false
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    setPasswordErrorMessage(
      i18next.t("keyring.setPassword.error.characterMaxCount")
    )
    return false
  }
  if (!PASSWORD_REGEX.test(password)) {
    setPasswordErrorMessage(
      i18next.t("keyring.setPassword.error.invalidCharacters")
    )
    return false
  }
  if (password !== passwordConfirmation) {
    setPasswordErrorMessage(i18next.t("keyring.setPassword.error.noMatch"))
    return false
  }

  return true
}
