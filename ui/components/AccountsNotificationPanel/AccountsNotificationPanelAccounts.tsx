import { Zone } from "quais"
import { useHistory } from "react-router-dom"
import { useTranslation } from "react-i18next"
import React, { ReactElement, useEffect, useRef, useState } from "react"

import {
  selectShowingAddAccountModal,
  setNewSelectedAccount,
  setSnackbarMessage,
} from "@pelagus/pelagus-background/redux-slices/ui"
import {
  AccountTotal,
  selectCurrentNetworkAccountTotalsByCategory,
  selectCurrentAccount,
  selectCurrentNetwork,
  CategorizedAccountTotals,
} from "@pelagus/pelagus-background/redux-slices/selectors"
import { VALID_ZONES } from "@pelagus/pelagus-background/constants"
import { sameQuaiAddress } from "@pelagus/pelagus-background/lib/utils"
import {
  ACCOUNT_TYPES,
  AccountType,
} from "@pelagus/pelagus-background/redux-slices/accounts"
import { deriveAddress } from "@pelagus/pelagus-background/redux-slices/keyrings"
import {
  isAccountWithSecrets,
  searchAccountsHandle,
} from "../../utils/accounts"
import {
  useBackgroundDispatch,
  useBackgroundSelector,
  useAreKeyringsUnlocked,
} from "../../hooks"

import SigningButton from "./SigningButton"
import WalletTypeHeader from "./WalletTypeHeader"
import SharedLoadingShip from "../Shared/SharedLoadingShip"
import AccountsSearchBar from "../AccountItem/AccountsSearchBar"
import SelectAccountListItem from "../AccountItem/SelectAccountListItem"
import AccountItemOptionsMenu from "../AccountItem/AccountItemOptionsMenu"

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

type AccountsNotificationPanelAccountsProps = {
  onCurrentAddressChange: (newAddress: string) => void
  setSelectedAccountSigner: (signerId: string) => void
  selectedAccountSigner: string
}

export default function AccountsNotificationPanelAccounts({
  onCurrentAddressChange,
  setSelectedAccountSigner,
  selectedAccountSigner,
}: AccountsNotificationPanelAccountsProps): ReactElement {
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

  const [searchAccountsValue, setSearchAccountsValue] = useState("")

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

  const [pendingSelectedAddress, setPendingSelectedAddress] = useState("")
  const defaultSigner = useRef(
    accountTotals.internal != undefined
      ? accountTotals.internal[0].signerId ?? ""
      : accountTotals.imported != undefined
      ? accountTotals.imported[0].signerId ?? ""
      : ""
  )

  const zone = useRef(Zone.Cyprus1)
  const handleSetZone = (newZone: Zone) => (zone.current = newZone)

  const isShowingAddAccountModal = useBackgroundSelector(
    selectShowingAddAccountModal
  )

  const selectedAccountAddress =
    useBackgroundSelector(selectCurrentAccount).address

  const updateCurrentAccount = (address: string, signerId: string) => {
    setPendingSelectedAddress(address)
    setSelectedAccountSigner(signerId)
    if (signerId === "") {
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

  const wasFoundAcc = useRef(false)

  useEffect(() => {
    wasFoundAcc.current = false
  }, [searchAccountsValue])

  return (
    <div className="switcher_wrap">
      <div className="account_actions_header">
        <AccountsSearchBar
          searchAccountsValue={searchAccountsValue}
          setSearchAccountsValue={setSearchAccountsValue}
        />
      </div>

      {ACCOUNT_TYPES.map((accountType, switcherWrapIdx) => {
        const accountTypeTotals = accountTotals[accountType]
        // If there are no account totals for the given type, skip the section.
        if (accountTypeTotals === undefined || accountTypeTotals.length <= 0) {
          return <></>
        }

        const filteredAccountTypeTotals = searchAccountsHandle(
          searchAccountsValue,
          accountTypeTotals
        )

        if (filteredAccountTypeTotals.length) wasFoundAcc.current = true

        const accountTotalsByType = filteredAccountTypeTotals.reduce(
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

        const existingAccountTypes = ACCOUNT_TYPES.filter(
          (type) => (accountTotals[type]?.length ?? 0) > 0
        )

        if (
          existingAccountTypes[existingAccountTypes?.length - 1] ===
            accountType &&
          !wasFoundAcc.current
        ) {
          return <p className="noAccounts">{t("accounts.noResults")}</p>
        }

        return (
          <div
            key={`${switcherWrapIdx}_${accountType}`}
            className="switcherWrapIdx"
          >
            {shouldAddHeader(existingAccountTypes, accountType) && (
              <div className="category_wrap simple_text">
                {isAccountWithSecrets(accountType) &&
                  filteredAccountTypeTotals.length > 0 && (
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
                      accountSigner={accountTotalsBySignerId[0].accountSigner}
                      signerId={accountTotalsBySignerId[0].signerId}
                      setZone={handleSetZone}
                      onClickAddAddress={
                        accountType === "imported" ||
                        accountType === "internal" ||
                        accountType === "private-key"
                          ? () => {
                              if (zone.current === null) {
                                throw new Error("zone is empty")
                              } else if (!VALID_ZONES.includes(zone.current)) {
                                dispatch(setSnackbarMessage("Invalid zone"))
                                throw new Error("zone is invalid")
                              }

                              if (selectedAccountSigner === "private-key") {
                                setSelectedAccountSigner(defaultSigner.current)
                                dispatch(
                                  deriveAddress({
                                    signerId: defaultSigner.current,
                                    zone: zone.current,
                                  })
                                )
                                return
                              }

                              if (!selectedAccountSigner) {
                                for (const account in accountTotals) {
                                  const accountTotalsArray =
                                    accountTotals[
                                      account as keyof CategorizedAccountTotals
                                    ]
                                  if (
                                    accountTotalsArray &&
                                    accountTotalsArray.find(
                                      (accountTotal) =>
                                        accountTotal.address ===
                                        selectedAccountAddress
                                    ) !== undefined
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
                                    zone: zone.current,
                                  })
                                )
                              } else {
                                dispatch(
                                  deriveAddress({
                                    signerId: selectedAccountSigner,
                                    zone: zone.current,
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
                        const isSelected = sameQuaiAddress(
                          accountTotal.address,
                          selectedAccountAddress
                        )

                        return (
                          <li
                            key={`${idx}-${accountTotal.address}`}
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
                                    accountTotal.address,
                                    accountTotal.signerId ?? ""
                                  )
                                }
                              }}
                              onClick={() => {
                                updateCurrentAccount(
                                  accountTotal.address,
                                  accountTotal.signerId ?? ""
                                )
                              }}
                            >
                              <SelectAccountListItem
                                key={accountTotal.address}
                                account={accountTotal}
                                isSelected={isSelected}
                              >
                                <AccountItemOptionsMenu
                                  accountTotal={accountTotal}
                                  moveAccountUp={moveAccountUp}
                                  moveAccountDown={moveAccountDown}
                                  signerId={accountTotalsBySignerId[0].signerId}
                                />
                              </SelectAccountListItem>
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
      <style jsx>
        {`
          .ul {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            align-content: center;
          }

          li {
            width: 100%;
            box-sizing: border-box;
            cursor: pointer;
          }
          .switcher_wrap {
            height: 432px;
            overflow-y: scroll;
          }
          .category_wrap {
            display: flex;
            justify-content: center;
            background-color: var(--hunter-green);
          }
          p {
            margin: 0;
          }

          .noAccounts {
            margin-top: 110px;
            display: flex;
            justify-content: center;
            color: var(--white);
            font-weight: 500;
            font-size: 18px;
            line-height: 20px;
          }

          .switcherWrapIdx {
            padding-bottom: 16px;
          }

          .switcherWrapIdx:last-of-type {
            padding-bottom: 0;
          }

          .account_actions_header {
            display: flex;
            flex-direction: column;
            gap: 16px;
            position: sticky;
            top: 0;
            left: 0;
            z-index: 2;
            padding: 0 16px 16px 16px;
            background: var(--hunter-green);
          }
        `}
      </style>
    </div>
  )
}
