import { SignOperationType } from "@pelagus/pelagus-background/redux-slices/signing"
import React, { ReactElement, useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { SignerFrameProps } from ".."
import { useBackgroundDispatch } from "../../../../hooks"
import SignerBaseFrame from "../SignerBaseFrame"
import SignerKeyringSigning from "./SignerKeyringSigning"

export default function SignerKeyringFrame<T extends SignOperationType>({
  children,
  signActionCreator,
  rejectActionCreator,
  signingActionLabelI18nKey,
  redirectToActivityPage,
}: SignerFrameProps<T>): ReactElement {
  const { t } = useTranslation()
  const [isSigning, setIsSigning] = useState(false)
  const dispatch = useBackgroundDispatch()

  const handleConfirm = useCallback(() => {
    setIsSigning(true)
  }, [setIsSigning])

  const handleSigningError = useCallback(() => {
    // Use setTimeout to ensure state update happens in a new tick
    setTimeout(() => {
      setIsSigning(false)
    }, 0)
  }, [setIsSigning])

  // All hooks are called before any conditional returns
  if (isSigning) {
    return (
      <SignerKeyringSigning
        signActionCreator={signActionCreator}
        redirectToActivityPage={redirectToActivityPage}
        onSigningError={handleSigningError}
      />
    )
  }

  return (
    <SignerBaseFrame
      signingActionLabel={t(signingActionLabelI18nKey)}
      onReject={() => dispatch(rejectActionCreator())}
      onConfirm={handleConfirm}
    >
      {children}
    </SignerBaseFrame>
  )
}
