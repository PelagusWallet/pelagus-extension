import { AccountType } from "@pelagus/pelagus-background/redux-slices/accounts"
import { AccountSigner } from "@pelagus/pelagus-background/services/signing"
import { useTranslation } from "react-i18next"

import { updateSignerTitle } from "@pelagus/pelagus-background/redux-slices/ui"
import React, { useMemo, useState } from "react"
import { isSameAccountSignerWithId } from "@pelagus/pelagus-background/utils/signing"

import { useBackgroundDispatch, useBackgroundSelector } from "../../hooks"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import EditSectionForm from "./EditSectionForm"
import { ONBOARDING_ROOT } from "../../pages/Onboarding/Tabbed/Routes"
import SharedDropdown from "../Shared/SharedDropDown"
import SharedIcon from "../Shared/SharedIcon"

type WalletTypeInfo = {
  title: string
  icon: string
  category: string
}

export default function WalletTypeHeader({
  accountType,
  walletNumber,
  accountSigner,
  signerId,
  updateCustomOrder,
  updateUseCustomOrder,
}: {
  accountType: AccountType
  accountSigner: AccountSigner
  signerId?: string | null
  walletNumber?: number
  updateCustomOrder: (address: string[], signerId: string) => void
  updateUseCustomOrder: (useOrder: boolean, signerId: string) => void
}) {
  const { t } = useTranslation()

  const [showEditMenu, setShowEditMenu] = useState(false)

  const walletTypeDetails: { [key in AccountType]: WalletTypeInfo } = {
    [AccountType.ReadOnly]: {
      title: t("accounts.notificationPanel.readOnly"),
      icon: "./images/eye@2x.png",
      category: t("accounts.notificationPanel.category.readOnly"),
    },
    [AccountType.Imported]: {
      title: t("accounts.notificationPanel.import"),
      icon: "./images/imported@2x.png",
      category: t("accounts.notificationPanel.category.others"),
    },
    [AccountType.PrivateKey]: {
      title: t("accounts.notificationPanel.privateKey"),
      icon: "./images/key-light.svg",
      category: t("accounts.notificationPanel.category.others"),
    },
    [AccountType.Internal]: {
      title: t("accounts.notificationPanel.internal"),
      icon: "./images/stars_grey.svg",
      category: t("accounts.notificationPanel.category.others"),
    },
  }
  const { title } = walletTypeDetails[accountType]
  const dispatch = useBackgroundDispatch()

  const settingsBySigner = useBackgroundSelector(
    (state) => state.ui.accountSignerSettings
  )

  const signerSettings =
    accountSigner.type !== "read-only"
      ? settingsBySigner.find(({ signer }) =>
          isSameAccountSignerWithId(signer, accountSigner)
        )
      : undefined

  const sectionCustomName = signerSettings?.title

  const sectionTitle = useMemo(() => {
    if (accountType === AccountType.ReadOnly) return title

    if (sectionCustomName) return `${sectionCustomName}`

    return `${title} ${walletNumber}`
  }, [accountType, title, sectionCustomName, walletNumber])

  return (
    <>
      {accountSigner.type !== AccountType.ReadOnly && (
        <SharedSlideUpMenu
          size="small"
          isOpen={showEditMenu}
          close={(e) => {
            e.stopPropagation()
            setShowEditMenu(false)
          }}
        >
          <EditSectionForm
            onSubmit={(newName) => {
              if (newName) {
                dispatch(updateSignerTitle([accountSigner, newName]))
              }
              setShowEditMenu(false)
            }}
            onCancel={() => setShowEditMenu(false)}
            accountTypeIcon={walletTypeDetails[accountType].icon}
            currentName={sectionTitle}
          />
        </SharedSlideUpMenu>
      )}

      <header className="wallet_title">
        <h2 className="left">
          {sectionTitle.length > 25
            ? `${sectionTitle.slice(0, 25)}...`
            : sectionTitle}
        </h2>
        {accountType !== AccountType.ReadOnly && (
          <SharedDropdown
            toggler={(toggle) => (
              <SharedIcon
                color="var(--green-40)"
                customStyles="cursor: pointer;"
                width={24}
                onClick={() => toggle()}
                icon="settings.svg"
              />
            )}
            options={[
              {
                key: "edit",
                icon: "icons/s/edit.svg",
                label: t("accounts.accountItem.editName"),
                onClick: () => setShowEditMenu(true),
              },
              accountType !== AccountType.PrivateKey
                ? {
                    key: "addWallet",
                    icon: "icons/s/add.svg",
                    label: t("accounts.notificationPanel.addWallet"),
                    onClick: () => {
                      window.open(ONBOARDING_ROOT)
                      window.close()
                    },
                  }
                : undefined,
              {
                key: "resetOrder",
                icon: "icons/s/refresh.svg",
                label: t("accounts.notificationPanel.resetOrder"),
                onClick: () => {
                  if (signerId != undefined) {
                    updateCustomOrder([], signerId)
                    updateUseCustomOrder(false, signerId)
                  }
                },
              },
            ]}
          />
        )}
      </header>
      <style jsx>{`
        .menu-content {
          top: 20px;
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 80%;
        }
        .menu-content > :first-child {
          margin: auto;
        }
        .menu-content > :last-child {
          margin-bottom: 16px;
        }

        .wallet_title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 0 16px 8px 16px;
        }

        .wallet_title > h2 {
          color: var(--green-40);
          font-size: 16px;
          font-weight: 500;
          margin: 0;
        }

        .left {
          align-items: center;
          display: flex;
        }
      `}</style>
    </>
  )
}
