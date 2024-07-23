import { AccountType } from "@pelagus/pelagus-background/redux-slices/accounts"
import { AccountSigner } from "@pelagus/pelagus-background/services/signing"
import { Zone } from "quais"
import { useTranslation } from "react-i18next"
import {
  VALID_ZONES,
  VALID_ZONES_NAMES,
} from "@pelagus/pelagus-background/constants"
import {
  setShowingAccountsModal,
  setShowingAddAccountModal,
  updateSignerTitle,
} from "@pelagus/pelagus-background/redux-slices/ui"
import React, { useEffect, useMemo, useState } from "react"
import { isSameAccountSignerWithId } from "@pelagus/pelagus-background/utils/signing"
import { useHistory } from "react-router-dom"
import { selectIsWalletExists } from "@pelagus/pelagus-background/redux-slices/selectors"
import {
  useAreKeyringsUnlocked,
  useBackgroundDispatch,
  useBackgroundSelector,
} from "../../hooks"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import EditSectionForm from "./EditSectionForm"
import SharedSelect from "../Shared/SharedSelect"
import SharedButton from "../Shared/SharedButton"
import OnboardingRoutes, {
  ONBOARDING_ROOT,
  PAGE_ROOT,
} from "../../pages/Onboarding/Tabbed/Routes"
import SharedORDivider from "../Shared/SharedORDivider"
import SharedDropdown from "../Shared/SharedDropDown"
import SharedIcon from "../Shared/SharedIcon"

type WalletTypeInfo = {
  title: string
  icon: string
  category: string
}

const sharedButtonStyle = {
  width: "-webkit-fill-available",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

export default function WalletTypeHeader({
  accountType,
  onClickAddAddress,
  walletNumber,
  accountSigner,
  signerId,
  setZone,
  addAddressSelected,
  updateCustomOrder,
  updateUseCustomOrder,
  setSelectedAccountSigner,
}: {
  accountType: AccountType
  onClickAddAddress?: () => void
  accountSigner: AccountSigner
  signerId?: string | null
  walletNumber?: number
  setZone: (zone: Zone) => void
  addAddressSelected: boolean
  updateCustomOrder: (address: string[], signerId: string) => void
  updateUseCustomOrder: (useOrder: boolean, signerId: string) => void
  setSelectedAccountSigner: (signerId: string) => void
}) {
  const { t } = useTranslation()

  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const history = useHistory()
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [showZoneMenu, setShowZoneMenu] = useState(false)
  const isWalletExists = useBackgroundSelector(selectIsWalletExists)

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
  const zoneOptions = VALID_ZONES.map((zone, index) => ({
    value: zone,
    label: VALID_ZONES_NAMES[index],
  }))

  const handleZoneSelection = (selectedZone: Zone) => {
    setZone(selectedZone as Zone)
  }

  useEffect(() => {
    if (addAddressSelected) {
      if (areKeyringsUnlocked) {
        setShowZoneMenu(true)
      } else {
        history.push("/keyring/unlock")
        dispatch(setShowingAddAccountModal(true))
        dispatch(setShowingAccountsModal(true))
      }
    }
  }, [addAddressSelected])

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
      <SharedSlideUpMenu
        size="custom"
        customSize="400px"
        isOpen={showZoneMenu}
        close={(e) => {
          e.stopPropagation()
          setShowZoneMenu(false)
          dispatch(setShowingAddAccountModal(false))
        }}
        customStyles={{
          display: "flex",
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div className="menu-content">
          {isWalletExists ? (
            <>
              <SharedSelect
                options={zoneOptions}
                onChange={(value: string) => handleZoneSelection(value as Zone)}
                defaultIndex={0}
                label="Choose Shard"
                width="100%"
                align-self="center"
              />
              <SharedButton
                type="tertiary"
                size="small"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  width: "fit-content",
                  marginLeft: "75%",
                }}
                onClick={() => {
                  onClickAddAddress && onClickAddAddress()
                  setShowZoneMenu(false)
                  dispatch(setShowingAddAccountModal(false))
                }}
              >
                Confirm
              </SharedButton>
            </>
          ) : (
            <SharedButton
              type="primary"
              size="small"
              style={{ ...sharedButtonStyle, marginTop: "20px" }}
              onClick={() => {
                setShowZoneMenu(false)
                dispatch(setShowingAddAccountModal(false))
                window.open(`${ONBOARDING_ROOT}`)
                window.close()
              }}
            >
              Add Wallet
            </SharedButton>
          )}

          <SharedORDivider />
          <SharedButton
            type="primary"
            size="small"
            style={sharedButtonStyle}
            onClick={() => {
              setShowZoneMenu(false)
              dispatch(setShowingAddAccountModal(false))
              window.open(`${PAGE_ROOT}${OnboardingRoutes.IMPORT_PRIVATE_KEY}`)
              window.close()
            }}
          >
            Import from Private Key
          </SharedButton>
        </div>
      </SharedSlideUpMenu>
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
              onClickAddAddress && {
                key: "addAddress",
                onClick: () => {
                  if (areKeyringsUnlocked) {
                    if (accountType === AccountType.PrivateKey) {
                      window.open(
                        `${PAGE_ROOT}${OnboardingRoutes.IMPORT_PRIVATE_KEY}`
                      )
                      window.close()
                      return
                    }

                    setSelectedAccountSigner(signerId ?? "")
                    setShowZoneMenu(true)
                  } else {
                    history.push("/keyring/unlock")
                  }
                },
                icon: "icons/s/add.svg",
                label: t("accounts.notificationPanel.addAddress"),
              },
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
