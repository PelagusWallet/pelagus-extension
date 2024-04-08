import { useState, useEffect } from "react"
import { useBackgroundSelector } from "./redux-hooks"
import { selectKeyringStatus } from "@pelagus/pelagus-background/redux-slices/selectors"

export const useAreKeyringsOnboardingUnlocked = (): boolean => {
  const [areKeyringsUnlocked, setAreKeyringsUnlocked] = useState<boolean>(false)

  const keyringStatus = useBackgroundSelector(selectKeyringStatus)

  useEffect(() => {
    console.log("waiting for update")
    setAreKeyringsUnlocked(keyringStatus === "unlocked")
  }, [keyringStatus])

  console.log("HOOK RESULT:", areKeyringsUnlocked)

  return areKeyringsUnlocked
}
