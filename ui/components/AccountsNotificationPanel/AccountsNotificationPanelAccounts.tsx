import React, {
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  selectShowingAddAccountModal,
  setNewSelectedAccount,
  setShowingAccountsModal,
  setShowingAddAccountModal,
  setSnackbarMessage,
  updateSignerTitle,
} from "@pelagus/pelagus-background/redux-slices/ui"
import { deriveAddress } from "@pelagus/pelagus-background/redux-slices/keyrings"
import {
  ROOTSTOCK,
  VALID_SHARDS,
  VALID_SHARDS_NAMES,
} from "@pelagus/pelagus-background/constants"
import {
  AccountTotal,
  selectCurrentNetworkAccountTotalsByCategory,
  selectCurrentAccount,
  selectCurrentNetwork,
  CategorizedAccountTotals,
  selectIsWalletExists,
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
import SharedIcon from "../Shared/SharedIcon"
import SharedDropdown from "../Shared/SharedDropDown"
import SharedSlideUpMenu from "../Shared/SharedSlideUpMenu"
import EditSectionForm from "./EditSectionForm"
import SigningButton from "./SigningButton"
import OnboardingRoutes, {
  ONBOARDING_ROOT,
  PAGE_ROOT,
} from "../../pages/Onboarding/Tabbed/Routes"
import SharedSelect from "../Shared/SharedSelect"
import SharedLoadingShip from "../Shared/SharedLoadingShip"
import { isAccountWithSecrets } from "../../utils/accounts"
import SharedORDivider from "../Shared/SharedORDivider"

type WalletTypeInfo = {
  title: string
  icon: string
  category: string
}

const shouldAddHeader = (
  existingAccountTypes: AccountType[],
  currentAccountType: AccountType
): boolean => {
  // Internal accounts, imported with mnemonic or private key are in the same section so we
  // only need to add that header once when we encounter such an account for the first time.
  switch (currentAccountType) {
    case AccountType.ReadOnly:
    case AccountType.Internal:
      return true
    case AccountType.Imported:
      return !existingAccountTypes.includes(AccountType.Internal)
    case AccountType.PrivateKey:
      return !(
        existingAccountTypes.includes(AccountType.Internal) ||
        existingAccountTypes.includes(AccountType.Imported)
      )
    default:
      throw Error("Unknown account type")
  }
}

const sharedButtonStyle = {
  width: "-webkit-fill-available",
  height: "40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}

function WalletTypeHeader({
  accountType,
  onClickAddAddress,
  walletNumber,
  path,
  accountSigner,
  signerId,
  setShard,
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
  path?: string | null
  setShard: (shard: string) => void
  addAddressSelected: boolean
  updateCustomOrder: (address: string[], signerId: string) => void
  updateUseCustomOrder: (useOrder: boolean, signerId: string) => void
  setSelectedAccountSigner: (signerId: string) => void
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
  const { title, icon } = walletTypeDetails[accountType]
  const dispatch = useBackgroundDispatch()
  const shardOptions = VALID_SHARDS.map((shard, index) => ({
    value: shard,
    label: VALID_SHARDS_NAMES[index],
  }))

  const handleShardSelection = (selectedShard: string) => {
    setShard(selectedShard)
    dispatch(setShowingAddAccountModal(false))
    // Call other required functions like onClickAddAddress
  }
  useEffect(() => {
    if (addAddressSelected) {
      if (areKeyringsUnlocked) {
        setShowShardMenu(true)
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

    let networkName = "" // Only for Rootstock
    if (path === ROOTSTOCK.derivationPath) networkName = `(${ROOTSTOCK.name})`

    if (sectionCustomName) return `${sectionCustomName} ${networkName}`

    return `${title} ${walletNumber} ${networkName}`
  }, [accountType, title, sectionCustomName, walletNumber, path])

  const history = useHistory()
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const [showEditMenu, setShowEditMenu] = useState(false)
  const [showShardMenu, setShowShardMenu] = useState(false)
  const isWalletExists = useBackgroundSelector(selectIsWalletExists)

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
        isOpen={showShardMenu}
        close={(e) => {
          e.stopPropagation()
          setShowShardMenu(false)
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
                options={shardOptions}
                onChange={handleShardSelection}
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
                  setShowShardMenu(false)
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
                setShowShardMenu(false)
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
              setShowShardMenu(false)
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
          <div className="icon_wrap">
            <div className="icon" />
          </div>
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
                    setShowShardMenu(true)
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
          margin--left: 30px;
          margin: auto;
        }
        .menu-content > :last-child {
          margin-bottom: 16px;
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
  setSelectedAccountSigner: (signerId: string) => void
  selectedAccountSigner: string
}

export default function AccountsNotificationPanelAccounts({
  onCurrentAddressChange,
  setSelectedAccountSigner,
  selectedAccountSigner,
}: Props): ReactElement {
  const { t } = useTranslation()
  const dispatch = useBackgroundDispatch()
  const history = useHistory()
  const selectedNetwork = useBackgroundSelector(selectCurrentNetwork)
  const areKeyringsUnlocked = useAreKeyringsUnlocked(false)
  const isMounted = useRef(false)
  const [isLoading, setIsLoading] = useState(true)
  const [customOrder, setCustomOrder] = useState<{ [key: string]: string[] }>(
    {}
  )
  const [useCustomOrder, setUseCustomOrder] = useState<{
    [key: string]: boolean
  }>({})

  useEffect(() => {
    const savedUseOrder = localStorage.getItem("useCustomOrder")
    if (savedUseOrder) {
      setUseCustomOrder(JSON.parse(savedUseOrder))
    }

    const savedOrder = localStorage.getItem("customOrder")
    if (savedOrder) {
      setCustomOrder(JSON.parse(savedOrder))
    }
    setIsLoading(false)
  }, [])

  const updateCustomOrder = async (newOrder: string[], signerId: string) => {
    setCustomOrder((prevOrder) => {
      const updatedOrder = {
        ...prevOrder,
        [signerId]: newOrder,
      }
      localStorage.setItem("customOrder", JSON.stringify(updatedOrder))
      return updatedOrder
    })
  }

  const updateUseCustomOrder = async (
    useCustomOrder: boolean,
    signerId: string
  ) => {
    setUseCustomOrder((prevUseOrder) => {
      const updatedUseOrder = {
        ...prevUseOrder,
        [signerId]: useCustomOrder,
      }
      localStorage.setItem("useCustomOrder", JSON.stringify(updatedUseOrder))
      return updatedUseOrder
    })
  }

  const moveAccountUp = (address: string, signerId: string) => {
    const index = customOrder[signerId].indexOf(address)
    if (index <= 0) return

    const newOrder = [...customOrder[signerId]]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = address

    updateCustomOrder(newOrder, signerId)
    if (!useCustomOrder[signerId]) updateUseCustomOrder(true, signerId)
  }

  const moveAccountDown = (address: string, signerId: string) => {
    const index = customOrder[signerId].indexOf(address)
    if (index === -1 || index === customOrder[signerId].length - 1) return

    const newOrder = [...customOrder[signerId]]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = address

    updateCustomOrder(newOrder, signerId)
    if (!useCustomOrder[signerId]) updateUseCustomOrder(true, signerId)
  }

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

  const [pendingSelectedAddress, setPendingSelectedAddress] = useState("")
  const defaultSigner = useRef(
    accountTotals.internal != undefined
      ? accountTotals.internal[0].signerId ?? ""
      : accountTotals.imported != undefined
      ? accountTotals.imported[0].signerId ?? ""
      : ""
  )
  const shard = useRef("")

  const handleSetShard = (newShard: string) => {
    // This is for updating user-selected shard for new address
    shard.current = newShard
  }

  const isShowingAddAccountModal = useBackgroundSelector(
    selectShowingAddAccountModal
  )

  const selectedAccountAddress =
    useBackgroundSelector(selectCurrentAccount).address

  const updateCurrentAccount = (address: string, signerId: string) => {
    dispatch(clearSignature())
    setPendingSelectedAddress(address)
    setSelectedAccountSigner(signerId)
    if (signerId == "") {
      console.error("signerId is empty")
    }
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
    AccountType.PrivateKey,
    AccountType.ReadOnly,
  ]

  return (
    <div className="switcher_wrap">
      {accountTypes.map((accountType, switcherWrapIdx) => {
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

        while (isLoading) {
          return SharedLoadingShip({
            size: 50,
            message: "Loading",
            padding: "40%",
            margin: "0",
            animated: true,
          })
        }

        for (const signerId in accountTotalsByType) {
          if (
            useCustomOrder[signerId] && customOrder[signerId]
              ? customOrder[signerId].length > 0
              : false
          ) {
            accountTotalsByType[signerId].sort((a, b) => {
              let indexOfA = customOrder[signerId].indexOf(a.address)
              let indexOfB = customOrder[signerId].indexOf(b.address)

              if (indexOfA === -1) {
                updateCustomOrder(
                  [...customOrder[signerId], a.address],
                  signerId
                )
                indexOfA = customOrder[signerId].length - 1
              }

              if (indexOfB == -1) {
                updateCustomOrder(
                  [...customOrder[signerId], b.address],
                  signerId
                )
                indexOfB = customOrder[signerId].length - 1
              }

              // If both addresses are found in customOrder, compare their indices
              if (indexOfA !== -1 && indexOfB !== -1) {
                return indexOfA - indexOfB
              }

              // If address A is not in customOrder, but B is, B should come first
              if (indexOfA === -1 && indexOfB !== -1) {
                return 1
              }

              // If address B is not in customOrder, but A is, A should come first
              if (indexOfA !== -1 && indexOfB === -1) {
                return -1
              }

              // If neither address is in customOrder, use localeCompare as a fallback
              return a.address.localeCompare(b.address)
            })
          } else {
            accountTotalsByType[signerId].sort((a, b) => {
              return a.address.localeCompare(b.address)
            })
            const newCustomOrder = accountTotalsByType[signerId].map(
              (item) => item.address
            )
            if (
              !(signerId in customOrder) ||
              newCustomOrder.length !== customOrder[signerId].length
            ) {
              updateCustomOrder(newCustomOrder, signerId)
            }
          }
        }

        const existingAccountTypes = accountTypes.filter(
          (type) => (accountTotals[type]?.length ?? 0) > 0
        )

        return (
          <div key={switcherWrapIdx}>
            {shouldAddHeader(existingAccountTypes, accountType) && (
              <div className="category_wrap simple_text">
                <p className="category_title">
                  {walletTypeDetails[accountType].category}
                </p>
                {isAccountWithSecrets(accountType) && (
                  <SigningButton
                    onCurrentAddressChange={onCurrentAddressChange}
                  />
                )}
              </div>
            )}
            {Object.values(accountTotalsByType).map(
              (accountTotalsBySignerId, idx) => {
                return (
                  <section key={`${idx}-${accountType}`}>
                    <WalletTypeHeader
                      accountType={accountType}
                      walletNumber={idx + 1}
                      path={accountTotalsBySignerId[0].path}
                      accountSigner={accountTotalsBySignerId[0].accountSigner}
                      signerId={accountTotalsBySignerId[0].signerId}
                      setShard={handleSetShard}
                      onClickAddAddress={
                        accountType === "imported" ||
                        accountType === "internal" ||
                        accountType === "private-key"
                          ? () => {
                              console.log(`onClickAddress ${shard.current}`)
                              if (shard.current === "") {
                                throw new Error("shard is empty")
                              } else if (
                                !VALID_SHARDS.includes(shard.current)
                              ) {
                                dispatch(setSnackbarMessage("Invalid shard"))
                                throw new Error("shard is invalid")
                              }

                              if (selectedAccountSigner === "private-key") {
                                setSelectedAccountSigner(defaultSigner.current)
                                dispatch(
                                  deriveAddress({
                                    signerId: defaultSigner.current,
                                    shard: shard.current,
                                  })
                                )
                              } else if (selectedAccountSigner == "") {
                                for (const account in accountTotals) {
                                  const accountTotalsArray =
                                    accountTotals[
                                      account as keyof CategorizedAccountTotals
                                    ]
                                  if (
                                    accountTotalsArray &&
                                    accountTotalsArray.find(
                                      (accountTotal) =>
                                        accountTotal.address ==
                                        selectedAccountAddress
                                    ) != undefined
                                  ) {
                                    if (
                                      accountTotalsArray[0].signerId ===
                                      "private-key"
                                    )
                                      break

                                    defaultSigner.current =
                                      accountTotalsArray[0].signerId ?? ""
                                    break
                                  }
                                }

                                setSelectedAccountSigner(defaultSigner.current)
                                dispatch(
                                  deriveAddress({
                                    signerId: defaultSigner.current,
                                    shard: shard.current,
                                  })
                                )
                              } else {
                                dispatch(
                                  deriveAddress({
                                    signerId: selectedAccountSigner,
                                    shard: shard.current,
                                  })
                                )
                              }
                            }
                          : undefined
                      }
                      addAddressSelected={isShowingAddAccountModal}
                      updateCustomOrder={updateCustomOrder}
                      updateUseCustomOrder={updateUseCustomOrder}
                      setSelectedAccountSigner={setSelectedAccountSigner}
                    />
                    <ul>
                      {accountTotalsBySignerId.map((accountTotal, idx) => {
                        const normalizedAddress = normalizeEVMAddress(
                          accountTotal.address
                        )

                        const isSelected = sameEVMAddress(
                          normalizedAddress,
                          selectedAccountAddress
                        )

                        return (
                          <li
                            key={`${idx}-${normalizedAddress}`}
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
                                  updateCurrentAccount(
                                    normalizedAddress,
                                    accountTotal.signerId ?? ""
                                  )
                                }
                              }}
                              onClick={() => {
                                dispatch(resetClaimFlow())
                                updateCurrentAccount(
                                  normalizedAddress,
                                  accountTotal.signerId ?? ""
                                )
                              }}
                            >
                              <SharedAccountItemSummary
                                key={normalizedAddress}
                                accountTotal={accountTotal}
                                isSelected={isSelected}
                              >
                                <AccountItemOptionsMenu
                                  accountTotal={accountTotal}
                                  moveAccountUp={moveAccountUp}
                                  moveAccountDown={moveAccountDown}
                                  signerId={accountTotalsBySignerId[0].signerId}
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
          </div>
        )
      })}
      <footer>
        <SharedButton
          type="tertiary"
          size="medium"
          iconSmall="add"
          iconPosition="left"
          onClick={() => dispatch(setShowingAddAccountModal(true))}
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
