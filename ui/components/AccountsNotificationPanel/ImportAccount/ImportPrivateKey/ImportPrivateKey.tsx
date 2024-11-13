import React, { useState } from "react"
import { useHistory } from "react-router-dom"
import { setShowingImportPrivateKeyModal } from "@pelagus/pelagus-background/redux-slices/ui"
import { AsyncThunkFulfillmentType } from "@pelagus/pelagus-background/redux-slices/utils"
import { SignerSourceTypes } from "@pelagus/pelagus-background/services/keyring/types"
import { importKeyring } from "@pelagus/pelagus-background/redux-slices/keyrings"
import {
  useAreKeyringsUnlocked,
  useBackgroundDispatch,
} from "../../../../hooks"
import { AccountCategoriesEnum } from "../../../../utils/enum/accountsEnum"
import SharedConfirmButton from "../../../Shared/_newDeisgn/actionButtons/SharedConfirmButton"

const ImportPrivateKey = ({
  accountCategory,
}: {
  accountCategory: AccountCategoriesEnum
}) => {
  const dispatch = useBackgroundDispatch()

  const [privateKey, setPrivateKey] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const history = useHistory()

  // TODO: ADD IMPORT QI PRIVATE KEY
  const importQiPrivateKey = async () => {}

  const importQuaiPrivateKey = async () => {
    const trimmedPrivateKey = privateKey.toLowerCase().trim()
    const { success, errorMessage: customError } = (await dispatch(
      importKeyring({
        type: SignerSourceTypes.privateKey,
        privateKey: trimmedPrivateKey,
      })
    )) as AsyncThunkFulfillmentType<typeof importKeyring>

    if (success) {
      await dispatch(setShowingImportPrivateKeyModal(false))
    }
    setErrorMessage(customError || "errorImport")
  }

  const importPrivateKey = async () => {
    if (!areKeyringsUnlocked) {
      history.push("/keyring/unlock")
      return
    }

    if (accountCategory === AccountCategoriesEnum.quai) {
      await importQuaiPrivateKey()
    } else {
      await importQiPrivateKey()
    }
  }

  const handleInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    setPrivateKey(value)
  }

  return (
    <>
      <div className="modal_body">
        <p className="modal_info">
          Importing a private key does not associate it to a secret recovery
          phrase, but it’s still protected by the same password.
        </p>
        <div>
          <input
            type="text"
            className="key-input"
            placeholder="Paste private key string..."
            value={privateKey}
            onChange={handleInput}
          />
          <p className="error_msg">{errorMessage}</p>
          <SharedConfirmButton
            title="Import From Private Key"
            onClick={importPrivateKey}
          />
        </div>
      </div>

      <style jsx>{`
        .modal_body {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .modal_info {
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--secondary-text);
          margin: 0;
        }

        .key-input {
          padding: 14px;
          width: 100%;
          font-size: 14px;
          font-weight: 500;
          line-height: 20px;
          color: var(--primary-text);
          border: 1px solid var(--tertiary-bg);
          border-radius: 8px;
          box-sizing: border-box;
        }

        .amount-input::placeholder {
          color: var(--secondary-text);
        }

        .error_msg {
          font-size: 12px;
          font-weight: 500;
          line-height: 14px;
          color: var(--error-color);
          margin: 0;
          padding: 4px;
          min-height: 16px;
        }
      `}</style>
    </>
  )
}

export default ImportPrivateKey
