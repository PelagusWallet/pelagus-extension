import {
  AccountTotal,
  selectKeyringByAddress,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import React, { ReactElement, useCallback } from "react"
import { useHistory } from "react-router-dom"
import { useTranslation } from "react-i18next"
import SharedButton from "../Shared/SharedButton"
import SharedAccountItemSummary from "../Shared/SharedAccountItemSummary"
import {
  useAreKeyringsUnlocked,
  useBackgroundDispatch,
  useBackgroundSelector,
} from "../../hooks"
import AccountItemActionHeader from "./AccountItemActionHeader"
import ClearHistoryWarning from "./ClearHistoryWarning"
import { removeAccountActivities, removeActivities } from "@pelagus/pelagus-background/redux-slices/activities"

interface AccountHistoryRemovalConfirmProps {
  account: AccountTotal
  close: () => void
}

export default function AccountHistoryRemovalConfirm({
  account,
  close,
}: AccountHistoryRemovalConfirmProps): ReactElement {
  const { address, network } = account

  const { t } = useTranslation("translation", {
    keyPrefix: "accounts.accountItem",
  })
  const dispatch = useBackgroundDispatch()
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const history = useHistory()
  const keyring = useBackgroundSelector(selectKeyringByAddress(address))
  const readOnlyAccount = typeof keyring === "undefined"

  const handleClearActivities = useCallback(() => {
    dispatch(removeActivities(address));
    dispatch(removeAccountActivities(address));
  }, [dispatch, address]);

  return (
    <div className="remove_history_option">
      <div className="header">
        <AccountItemActionHeader
          label={t("clearHistory")}
          icon="garbage@2x.png"
          color="var(--error)"
        />
      </div>
      <ul>
        <li className="account_container">
          <li className="standard_width">
            <SharedAccountItemSummary
              accountTotal={account}
              isSelected={false}
            />
          </li>
        </li>
      </ul>
      <div className="remove_address_details">
        <ClearHistoryWarning/>
      </div>
      <div className="button_container">
        <SharedButton
          type="secondary"
          size="medium"
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
        >
          {t("cancel")}
        </SharedButton>
        <SharedButton
          type="primary"
          size="medium"
          onClick={(e) => {
            e.stopPropagation()
            // don't prompt for unlock if removing read-only account.
            if (readOnlyAccount || areKeyringsUnlocked) {
                handleClearActivities()
              close()

            } else {
              history.push("/keyring/unlock")
            }
          }}
        >
          {t("clearConfirm")}
        </SharedButton>
      </div>
      <style jsx>{`
        li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 0 auto;
          width: 336px;
          height: 52px;
        }
        .header {
          height: 24px;
        }
        .remove_history_option {
          margin-left: 20px;
          margin-right: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 95%;
        }
        .remove_address_details {
          display: flex;
          flex-direction: column;
          line-height: 24px;
          font-size 16px;
        }
        .button_container {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
        }
        .account_container {
          margin-top: -10px;
          background-color: var(--hunter-green);
          padding: 5px;
          border-radius: 16px;
        }
      `}</style>
    </div>
  )
}
