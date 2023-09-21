import React, {
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  setNewSelectedAccount,
  setSnackbarMessage,
  updateSignerTitle,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { deriveAddress } from "@pelagus/pelagus-background/redux-slices/keyrings"
import { ROOTSTOCK, VALID_SHARDS } from "@pelagus/pelagus-background/constants"
import {
  AccountTotal,
  selectCurrentNetworkAccountTotalsByCategory,
  selectCurrentAccount,
  selectCurrentNetwork,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { useHistory } from "react-router-dom"
import { AccountType } from "@pelagus/pelagus-background/redux-slices/accounts"
import {
  normalizeEVMAddress,
  sameEVMAddress,
} from "@pelagus/pelagus-background/lib/utils"
import { clearSignature } from "@pelagus/pelagus-background/redux-slices/earn"
import { resetClaimFlow } from "@pelagus/pelagus-background/redux-slices/claim"
import { useTranslation } from "react-i18next"
import { AccountSigner } from "@pelagus/pelagus-background/services/signing"
import { isSameAccountSignerWithId } from "@pelagus/pelagus-background/utils/signing"
import SharedButton from "../Shared/SharedButton"
import {
  useBackgroundDispatch,
  useBackgroundSelector,
  useAreKeyringsUnlocked,
} from "../../hooks"
import SharedAccountItemSummary from "../Shared/SharedAccountItemSummary"
import AccountItemOptionsMenu from "../AccountItem/AccountItemOptionsMenu"
import { i18n } from "../../_locales/i18n"
import SharedIcon from "../Shared/SharedIcon"
import SharedDropdown from "../Shared/SharedDropDown"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import EditSectionForm from "./EditSectionForm"
import SigningButton from "./SigningButton"
import { ONBOARDING_ROOT } from "../../pages/Onboarding/Tabbed/Routes"
import SharedSelect from "../Shared/SharedSelect"

type WalletTypeInfo = {
  title: string
  icon: string
  category: string
}


function WalletTypeHeader({
  accountType,
  onClickAddAddress,
  walletNumber,
  path,
  accountSigner,
  setShard,
  addAddressSelected,
  setAddAddressSelected,
}: {
  accountType: AccountType
  onClickAddAddress?: () => void
  accountSigner: AccountSigner
  walletNumber?: number
  path?: string | null
  setShard: (shard: string) => void
  addAddressSelected: boolean
  setAddAddressSelected: (selected: boolean) => void
}) {
  const { t } = useTranslation()
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
    [AccountType.Internal]: {
      title: t("accounts.notificationPanel.internal"),
      icon: "./images/stars_grey.svg",
      category: t("accounts.notificationPanel.category.others"),
    },
    [AccountType.Ledger]: {
      title: t("accounts.notificationPanel.ledger"),
      icon: "./images/ledger_icon.svg",
      category: t("accounts.notificationPanel.category.ledger"),
    },
  }
  const { title, icon } = walletTypeDetails[accountType]
  const dispatch = useBackgroundDispatch()
  const shardOptions = VALID_SHARDS.map((shard) => ({
    value: shard,
    label: shard,
  }));

  const handleShardSelection = (selectedShard: string) => {
    setShard(selectedShard);
    setAddAddressSelected(false);
    // Call other required functions like onClickAddAddress
  };
  useEffect(() => {
    if(addAddressSelected) {
      if (areKeyringsUnlocked) {
        setShowShardMenu(true)
      } else {
        history.push("/keyring/unlock")
        setAddAddressSelected(false)
      }
    }
}, [addAddressSelected]);

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

    let networkName = "" // Only for Rootstock
    if (path === ROOTSTOCK.derivationPath) networkName = `(${ROOTSTOCK.name})`

    if (sectionCustomName) return `${sectionCustomName} ${networkName}`

    return `${title} ${walletNumber} ${networkName}`
  }, [accountType, title, sectionCustomName, walletNumber, path])

  const history = useHistory()
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [showShardMenu, setShowShardMenu] = useState(false)
  const dropdownTogglerRef = useRef(null);
  
  return (
    <>
      {accountSigner.type !== "read-only" && (
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
  size="xsmall"
  isOpen={showShardMenu}
  close={(e) => {
    e.stopPropagation();
    setShowShardMenu(false);
    setAddAddressSelected(false);
  }}
  customStyles={{ display: "flex", width: "100%", justifyContent: "center", alignItems: "center" }}
>
  <div className="menu-content">
    <SharedSelect
      options={shardOptions}
      onChange={handleShardSelection}
      defaultIndex={0}
      label="Choose Shard"
      width="100%"

      align-self='center'
      
    />

    <SharedButton
      type="tertiary"
      size="small"
      style={{ display: "flex", justifyContent: "flex-end", width: "fit-content", marginLeft: '75%' }}
      onClick={() => {
        onClickAddAddress && onClickAddAddress();
        setShowShardMenu(false);
        setAddAddressSelected(false);
      }}
    >
      Confirm
    </SharedButton>
  </div>
</SharedSlideUpMenu>


      
      <header className="wallet_title">
        <h2 className="left">
          <div className="icon_wrap">
            <div className="icon" />
          </div>
          {sectionTitle.length > 25 ? (sectionTitle.slice(0, 25) + "...") : sectionTitle}
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
              {
                key: "addWallet",
                icon: "icons/s/add.svg",
                label: t("accounts.notificationPanel.addWallet"),
                onClick: () => {
                  window.open(ONBOARDING_ROOT)
                  window.close()
                },
              },
              onClickAddAddress && {
                key: "addAddress",
                onClick: () => {
                  if (areKeyringsUnlocked) {
                    setShowShardMenu(true)
                  } else {
                    history.push("/keyring/unlock")
                  }
                },
                icon: "icons/s/add.svg",
                label: t("accounts.notificationPanel.addAddress"),
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
            margin--left: 30px;
            margin: auto; 
          }
          .menu-content > :last-child {
            
            margin-bottom: 16px; 
            margin-right: 16px; 
          }
        .wallet_title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 16px;
          padding-right: 4px;
        }
        .wallet_title > h2 {
          color: var(--green-40);
          font-size: 18px;
          font-weight: 600;
          line-height: 24px;
          padding: 0px 12px 0px 24px;
          margin: 8px 0px;
        }
        .icon_wrap {
          background-color: var(--hunter-green);
          margin: 0 7px 0 0;
          border-radius: 4px;
        }
        .icon {
          mask-image: url("${icon}");
          mask-size: cover;
          background-color: var(--trophy-gold);
          width: 24px;
          height: 24px;
        }
        .icon_wallet {
          background: url("./images/wallet_kind_icon@2x.png") center no-repeat;
          background-size: cover;
          width: 24px;
          height: 24px;
          margin-right: 8px;
        }
        .icon_edit {
          background: url("./images/edit@2x.png") center no-repeat;
          background-size: cover;
          width: 13px;
          height: 13px;
          margin-left: 8px;
        }
        .left {
          align-items: center;
          display: flex;
        }
        .right {
          align-items: center;
          margin-right: 4px;
        }
      `}</style>
    </>
  )
}

type Props = {
  onCurrentAddressChange: (newAddress: string) => void
}

export default function AccountsNotificationPanelAccounts({
  onCurrentAddressChange,
}: Props): ReactElement {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const isMounted = useRef(false)

  const accountTotals = useBackgroundSelector(
    selectCurrentNetworkAccountTotalsByCategory
  )
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
    [AccountType.Internal]: {
      title: t("accounts.notificationPanel.internal"),
      icon: "./images/stars_grey.svg",
      category: t("accounts.notificationPanel.category.others"),
    },
    [AccountType.Ledger]: {
      title: t("accounts.notificationPanel.ledger"),
      icon: "./images/ledger_icon.svg",
      category: t("accounts.notificationPanel.category.ledger"),
    },
  }

  const [pendingSelectedAddress, setPendingSelectedAddress] = useState("")
  const shard = useRef("")

  const handleSetShard = (newShard: string) => { // This is for updating user-selected shard for new address
    console.log(newShard)
    shard.current = newShard
  }

  const [addAddressSelected, setAddAddressSelected] = useState(false)

  const selectedAccountAddress =
    useBackgroundSelector(selectCurrentAccount).address

  const updateCurrentAccount = (address: string) => {
    dispatch(clearSignature())
    setPendingSelectedAddress(address)
    dispatch(
      setNewSelectedAccount({
        address,
        network: selectedNetwork,
      })
    )
  }

  useEffect(() => {
    if (
      pendingSelectedAddress !== "" &&
      pendingSelectedAddress === selectedAccountAddress
    ) {
      onCurrentAddressChange(pendingSelectedAddress)
      setPendingSelectedAddress("")
    }
  }, [onCurrentAddressChange, pendingSelectedAddress, selectedAccountAddress])

  useEffect(() => {
    // Prevents notifications from displaying when the component is not yet mounted
    if (!isMounted.current) {
      isMounted.current = true
    } else if (!areKeyringsUnlocked) {
      dispatch(setSnackbarMessage(t("accounts.notificationPanel.snackbar")))
    }
  }, [history, areKeyringsUnlocked, dispatch, t])

  const accountTypes = [
    AccountType.Internal,
    AccountType.Imported,
    AccountType.ReadOnly,
    AccountType.Ledger,
  ]

  return (
    <div className="switcher_wrap">
      {accountTypes.map((accountType) => {
        const accountTypeTotals = accountTotals[accountType]

        // If there are no account totals for the given type, skip the section.
        if (accountTypeTotals === undefined || accountTypeTotals.length <= 0) {
          return <></>
        }

        const accountTotalsByType = accountTypeTotals.reduce(
          (acc, accountTypeTotal) => {
            if (accountTypeTotal.signerId) {
              acc[accountTypeTotal.signerId] ??= []
              acc[accountTypeTotal.signerId].push(accountTypeTotal)
            } else {
              acc.readOnly ??= []
              acc.readOnly.push(accountTypeTotal)
            }
            return acc
          },
          {} as { [signerId: string]: AccountTotal[] }
        )

        return (
          <>
            {!(
              accountType === AccountType.Imported &&
              (accountTotals[AccountType.Internal]?.length ?? 0)
            ) && (
              <div className="category_wrap simple_text">
                <p className="category_title">
                  {walletTypeDetails[accountType].category}
                </p>
                {(accountType === AccountType.Imported ||
                  accountType === AccountType.Internal) && (
                  <SigningButton
                    onCurrentAddressChange={onCurrentAddressChange}
                  />
                )}
              </div>
            )}
            {Object.values(accountTotalsByType).map(
              (accountTotalsBySignerId, idx) => {
                return (
                  <section key={accountType}>
                    <WalletTypeHeader
                      accountType={accountType}
                      walletNumber={idx + 1}
                      path={accountTotalsBySignerId[0].path}
                      accountSigner={accountTotalsBySignerId[0].accountSigner}
                      setShard={handleSetShard}
                      onClickAddAddress={
                        accountType === "imported" || accountType === "internal"
                          ? () => {
                              if (accountTotalsBySignerId[0].signerId) {
                                console.log("onClickAddress " + shard.current)
                                if (shard.current === "") {
                                  throw new Error("shard is empty")
                                } else if (!VALID_SHARDS.includes(shard.current)) {
                                  dispatch(setSnackbarMessage("Invalid shard"))
                                  throw new Error("shard is invalid")
                                  return
                                }
                                dispatch(
                                  deriveAddress(
                                    {signerId: accountTotalsBySignerId[0].signerId, shard: shard.current }
                                  )
                                )
                              }
                            }
                          : undefined
                      }
                      addAddressSelected={addAddressSelected}
                      setAddAddressSelected={setAddAddressSelected}
                    />
                    <ul>
                      {accountTotalsBySignerId.map((accountTotal) => {
                        const normalizedAddress = normalizeEVMAddress(
                          accountTotal.address
                        )

                        const isSelected = sameEVMAddress(
                          normalizedAddress,
                          selectedAccountAddress
                        )

                        return (
                          <li
                            key={normalizedAddress}
                            // We use these event handlers in leiu of :hover so that we can prevent child hovering
                            // from affecting the hover state of this li.
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--hunter-green)"
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "var(--hunter-green)"
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = ""
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.backgroundColor = ""
                            }}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateCurrentAccount(normalizedAddress)
                                }
                              }}
                              onClick={() => {
                                dispatch(resetClaimFlow())
                                updateCurrentAccount(normalizedAddress)
                              }}
                            >
                              <SharedAccountItemSummary
                                key={normalizedAddress}
                                accountTotal={accountTotal}
                                isSelected={isSelected}
                              >
                                <AccountItemOptionsMenu
                                  accountTotal={accountTotal}
                                />
                              </SharedAccountItemSummary>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              }
            )}
          </>
        )
      })}
      <footer>
      <SharedButton
          type="tertiary"
          size="medium"
          iconSmall="add"
          iconPosition="left"
          onClick={() => {
            setAddAddressSelected(true)
          }}
        >
          {t("accounts.notificationPanel.addAddress")}
        </SharedButton>
      </footer>
      <style jsx>
        {`
          ul {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            align-content: center;
            margin-bottom: 8px;
          }
          section:last-of-type {
            margin-bottom: 16px;
          }
          li {
            width: 100%;
            box-sizing: border-box;
            padding: 8px 0px 8px 24px;
            cursor: pointer;
          }
          footer {
            width: 100%;
            height: 48px;
            background-color: var(--hunter-green);
            position: fixed;
            bottom: 0px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 0px 12px;
            box-sizing: border-box;
          }
          .switcher_wrap {
            height: 432px;
            overflow-y: scroll;
            border-top: 1px solid var(--green-120);
          }
          .category_wrap {
            display: flex;
            justify-content: space-between;
            background-color: var(--hunter-green);
            padding: 8px 10px 8px 24px;
          }
          .category_title {
            color: var(--green-60);
          }
          p {
            margin: 0;
          }
        `}
      </style>
    </div>
  )
}
