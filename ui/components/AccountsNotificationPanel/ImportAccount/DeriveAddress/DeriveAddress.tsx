import { useHistory } from "react-router-dom"
import {
  setShowingAddAccountModal,
  setSnackbarConfig,
} from "@pelagus/pelagus-background/redux-slices/ui"
import {
  selectCurrentAccountTotal,
  selectCurrentNetworkAccountTotalsByCategory,
  selectIsWalletExists,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import React, { useState } from "react"
import { toZone, Zone } from "quais"
import {
  VALID_ZONES,
  VALID_ZONES_NAMES,
} from "@pelagus/pelagus-background/constants"
import { deriveAddress } from "@pelagus/pelagus-background/redux-slices/keyrings"
import {
  ACCOUNT_TYPES,
  AccountType,
} from "@pelagus/pelagus-background/redux-slices/accounts"
import {
  useAreKeyringsUnlocked,
  useBackgroundDispatch,
  useBackgroundSelector,
} from "../../../../hooks"
import SharedSelectMenu from "../../../Shared/_newDeisgn/selectMenu/SharedSelectMenu"
import { ONBOARDING_ROOT } from "../../../../pages/Onboarding/Tabbed/Routes"
import SharedCancelButton from "../../../Shared/_newDeisgn/actionButtons/SharedCancelButton"
import { Option } from "../../../Shared/SharedSelect"

const DeriveAddress = () => {
  const history = useHistory()
  const dispatch = useBackgroundDispatch()

  const quaiAcc = useBackgroundSelector(
    selectCurrentNetworkAccountTotalsByCategory
  )

  const currentAcc = useBackgroundSelector(selectCurrentAccountTotal)

  const [zone, setZone] = useState<Option>({
    value: Zone.Cyprus1,
    label: "Cyprus-1",
  })

  const isWalletExists = useBackgroundSelector(selectIsWalletExists)

  const zoneOptions = VALID_ZONES.map((item, index) => ({
    value: item,
    label: VALID_ZONES_NAMES[index],
  }))

  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)

  const signerIdHandle = () => {
    if (
      currentAcc?.signerId &&
      !ACCOUNT_TYPES.includes(currentAcc?.signerId as AccountType)
    ) {
      return currentAcc?.signerId
    }
    return (
      quaiAcc?.internal?.[0].signerId || quaiAcc?.imported?.[0].signerId || ""
    )
  }

  const deriveAddressHandle = async () => {
    if (!areKeyringsUnlocked) {
      history.push("/keyring/unlock")
      return
    }

    if (zone?.value === null || !VALID_ZONES.includes(toZone(zone?.value))) {
      await dispatch(setSnackbarConfig({ message: "Invalid zone" }))
      return
    }

    const signerId = signerIdHandle()

    if (!signerId) {
      await dispatch(setSnackbarConfig({ message: "No account found" }))
      return
    }

    await dispatch(
      deriveAddress({
        signerId,
        zone: toZone(zone?.value),
      })
    )

    await dispatch(setShowingAddAccountModal(false))
  }

  const addWalletHandle = async () => {
    await dispatch(setShowingAddAccountModal(false))
    window.open(`${ONBOARDING_ROOT}`)
    window.close()
  }

  if (!isWalletExists) {
    return (
      <div style={{ marginBottom: "16px" }}>
        <SharedCancelButton title="Add Wallet" onClick={addWalletHandle} />
      </div>
    )
  }
  return (
    <>
      <div className="modal_body">
        <>
          <SharedSelectMenu
            options={zoneOptions}
            label="Select a Shard"
            onSelectOption={setZone}
            selectedOption={zone}
          />

          <button
            type="button"
            className="confirm_button"
            onClick={deriveAddressHandle}
          >
            Confirm
          </button>
        </>
      </div>

      <style jsx>{`
        .modal_body {
          margin-bottom: 24px;
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .confirm_button:hover,
        .addWallet_button:hover {
          opacity: 90%;
        }

        .confirm_button {
          box-sizing: border-box;
          width: 40%;
          font-weight: 700;
          font-size: 14px;
          line-height: 20px;
          padding: 10px 26px;
          border-radius: 4px;
          background: var(--accent-color);
          color: var(--contrast-text);
          text-align: center;
        }
      `}</style>
    </>
  )
}

export default DeriveAddress
