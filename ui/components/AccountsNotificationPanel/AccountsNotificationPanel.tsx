import React, { ReactElement, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  selectShowingAccountsModal,
  setShowingAccountsModal,
  setShowingAddAccountModal,
  setShowingImportPrivateKeyModal,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { selectIsUtxoSelected } from "@pelagus/pelagus-background/redux-slices/selectors"
import AccountsNotificationPanelAccounts from "./AccountsNotificationPanelAccounts"
import SharedDrawer from "../Shared/SharedDrawer"
import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SelectAccountCategoryTabs from "./SelectAccountCategoryTabs"
import { AccountCategoriesEnum } from "../../utils/enum/accountsEnum"
import QiAccountsList from "../_NewDesign/QiAccountsList/QiAccountsList"
import ImportAccount from "./ImportAccount/ImportAccount"

type Props = {
  onCurrentAddressChange: (address: string) => void
  isNeedToChangeAccount?: boolean
}

export default function AccountsNotificationPanel({
  onCurrentAddressChange,
  isNeedToChangeAccount = true,
}: Props): ReactElement {
  const { t } = useTranslation("translation", { keyPrefix: "topMenu" })
  const dispatch = useBackgroundDispatch()

  useEffect(() => {
    dispatch(setShowingAddAccountModal(false))
  }, [])

  const isShowingAccountsModal = useBackgroundSelector(
    selectShowingAccountsModal
  )

  const isUtxoSelected = useBackgroundSelector(selectIsUtxoSelected)

  const [accountCategory, setAccountCategory] = useState<AccountCategoriesEnum>(
    isUtxoSelected && isNeedToChangeAccount
      ? AccountCategoriesEnum.qi
      : AccountCategoriesEnum.quai
  )

  const onAddAccount = async () => {
    if (accountCategory === AccountCategoriesEnum.quai) {
      await dispatch(setShowingAddAccountModal(true))
      return
    }

    await dispatch(setShowingImportPrivateKeyModal(true))
  }

  return (
    <>
      <SharedDrawer
        title={t("accountSelect")}
        isOpen={isShowingAccountsModal}
        close={() => dispatch(setShowingAccountsModal(false))}
        fillAvailable
        customStyles={{ padding: "24px 0" }}
        titleWithoutSidePaddings
        footer={
          <div className="footer_wrap">
            <button
              type="button"
              onClick={onAddAccount}
              className="confirmation-btn"
            >
              &#43;{" "}
              {accountCategory === AccountCategoriesEnum.quai
                ? t("addQuaiaccount")
                : t("addQiaccount")}
            </button>
          </div>
        }
      >
        {isNeedToChangeAccount && (
          <SelectAccountCategoryTabs
            accountCategory={accountCategory}
            setAccountCategory={setAccountCategory}
          />
        )}
        {accountCategory === AccountCategoriesEnum.quai ? (
          <AccountsNotificationPanelAccounts
            onCurrentAddressChange={onCurrentAddressChange}
            isNeedToChangeAccount={isNeedToChangeAccount}
          />
        ) : (
          isNeedToChangeAccount && <QiAccountsList />
        )}
      </SharedDrawer>

      <ImportAccount accountCategory={accountCategory} />

      <style jsx>
        {`
          .confirmation-btn {
            font-weight: 500;
            line-height: 20px;
            border: 1px solid var(--white);
            border-radius: 4px;
            width: 100%;
            min-height: 40px;
            padding: 10px;
            text-align: center;
            box-sizing: border-box;
            color: var(--white);
            margin: 0;
          }

          .confirmation-btn:hover {
            color: var(--green-40);
          }

          .footer_wrap {
            width: 100%;
            position: fixed;
            bottom: 16px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 0 16px;
            box-sizing: border-box;
          }
        `}
      </style>
    </>
  )
}
