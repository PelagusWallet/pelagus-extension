import { createSelector } from "@reduxjs/toolkit"
import { selectHideDust, selectShowUnverifiedAssets } from "../ui"
import { RootState } from ".."
import { AccountType, CompleteAssetAmount } from "../accounts"
import { QiCoinbaseAddress } from "../../accounts"
import { AssetsState, selectAssetPricePoint } from "../assets"
import {
  enrichAssetAmountWithDecimalValues,
  enrichAssetAmountWithMainCurrencyValues,
  formatCurrencyAmount,
  heuristicDesiredDecimalsForUnitPrice,
  isNetworkBaseAsset,
  isUnverifiedAssetByUser,
} from "../utils/asset-utils"
import {
  AnyAsset,
  AnyAssetAmount,
  assetAmountToDesiredDecimals,
  convertAssetAmountViaPricePoint,
  isSmartContractFungibleAsset,
} from "../../assets"
import {
  selectCurrentAccount,
  selectCurrentNetwork,
  selectMainCurrencySymbol,
} from "./uiSelectors"
import { convertToEth, sameQuaiAddress, truncateAddress } from "../../lib/utils"
import { selectAccountSignersByAddress } from "./signingSelectors"
import {
  selectKeyringsByAddresses,
  selectSourcesByAddress,
} from "./keyringsSelectors"
import { AccountBalance, AddressOnNetwork } from "../../accounts"
import { sameNetwork } from "../../networks"
import { AccountSigner, SignerType } from "../../services/signing"
import { assertUnreachable } from "../../lib/utils/type-guards"
import { getExtendedZoneForAddress } from "../../services/chain/utils"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { SignerImportSource } from "../../services/keyring/types"

// TODO What actual precision do we want here? Probably more than 2
// TODO decimals? Maybe it's configurable?
const desiredDecimals = {
  default: 2,
  greater: 6,
}

// List of assets by symbol that should be displayed with more decimal places
const EXCEPTION_ASSETS_BY_SYMBOL = ["BTC", "sBTC", "WBTC", "tBTC"].map(
  (symbol) => symbol.toUpperCase()
)

// Preferred display priority among non-base assets
const SYMBOL_PRIORITY: string[] = ["WQI", "USDT", "WQUAI"]
const getSymbolPriority = (symbol: string): number => {
  const idx = SYMBOL_PRIORITY.indexOf(symbol.toUpperCase())
  return idx === -1 ? Number.POSITIVE_INFINITY : idx
}

// TODO Make this a setting.
export const userValueDustThreshold = 2

const ALWAYS_VISIBLE_SYMBOLS = new Set(["WQI", "WQUAI", "USDT"]) // ensure visible even at 0

const shouldForciblyDisplayAsset = (
  assetAmount: CompleteAssetAmount<AnyAsset>
) => {
  return (
    isNetworkBaseAsset(assetAmount.asset) ||
    ALWAYS_VISIBLE_SYMBOLS.has(assetAmount.asset.symbol.toUpperCase())
  )
}

const isImportedAsset = (asset: AnyAsset): boolean => {
  return (
    isSmartContractFungibleAsset(asset) &&
    (asset.metadata?.tokenLists?.length ?? 0) === 0
  )
}

const getAssetCategory = (asset: AnyAsset): number => {
  // 0: base asset, 1: pinned symbol, 2: other non-imported, 3: imported
  if (isNetworkBaseAsset(asset)) return 0
  if (SYMBOL_PRIORITY.includes(asset.symbol.toUpperCase())) return 1
  if (isImportedAsset(asset)) return 3
  return 2
}

const compareCompleteAssets = (
  asset1: CompleteAssetAmount,
  asset2: CompleteAssetAmount
) => {
  const leftCat = getAssetCategory(asset1.asset)
  const rightCat = getAssetCategory(asset2.asset)

  if (leftCat !== rightCat) return leftCat - rightCat

  // Pinned: honor explicit order
  if (leftCat === 1) {
    return (
      getSymbolPriority(asset1.asset.symbol) -
      getSymbolPriority(asset2.asset.symbol)
    )
  }

  // Otherwise: keep existing value-based ordering
  if (
    asset1.mainCurrencyAmount !== undefined &&
    asset2.mainCurrencyAmount !== undefined
  ) {
    const diff = asset2.mainCurrencyAmount - asset1.mainCurrencyAmount
    if (diff !== 0) return diff
    const p1 = getSymbolPriority(asset1.asset.symbol)
    const p2 = getSymbolPriority(asset2.asset.symbol)
    if (p1 !== p2) return p1 - p2
    return asset1.asset.symbol.localeCompare(asset2.asset.symbol)
  }

  if (asset1.mainCurrencyAmount === asset2.mainCurrencyAmount) {
    const p1 = getSymbolPriority(asset1.asset.symbol)
    const p2 = getSymbolPriority(asset2.asset.symbol)
    if (p1 !== p2) return p1 - p2
    return asset1.asset.symbol.localeCompare(asset2.asset.symbol)
  }

  return asset1.mainCurrencyAmount === undefined ? 1 : -1
}

export function determineAssetDisplayAndVerify(
  assetAmount: CompleteAssetAmount<AnyAsset>,
  {
    hideDust,
    showUnverifiedAssets,
  }: { hideDust: boolean; showUnverifiedAssets: boolean }
): { displayAsset: boolean; verifiedAsset: boolean } {
  const isVerified = !isUnverifiedAssetByUser(assetAmount.asset)

  if (shouldForciblyDisplayAsset(assetAmount))
    return { displayAsset: true, verifiedAsset: isVerified }

  const isNotDust =
    typeof assetAmount.mainCurrencyAmount === "undefined"
      ? true
      : assetAmount.mainCurrencyAmount > userValueDustThreshold
  const isPresent = assetAmount.decimalAmount > 0
  const showDust = !hideDust

  const verificationStatusAllowsVisibility = showUnverifiedAssets || isVerified
  const enoughBalanceToBeVisible = isPresent && (isNotDust || showDust)

  return {
    displayAsset:
      verificationStatusAllowsVisibility && enoughBalanceToBeVisible,
    verifiedAsset: isVerified,
  }
}

const computeCombinedAssetAmountsData = (
  assetAmounts: AnyAssetAmount<AnyAsset>[],
  lockedAssetAmounts: AnyAssetAmount<AnyAsset>[],
  assets: AssetsState,
  mainCurrencySymbol: string,
  hideDust: boolean,
  showUnverifiedAssets: boolean
): {
  allAssetAmounts: CompleteAssetAmount[]
  lockedAssetAmounts: CompleteAssetAmount[]
  combinedAssetAmounts: CompleteAssetAmount[]
  unverifiedAssetAmounts: CompleteAssetAmount[]
  totalMainCurrencyAmount: number | undefined
  totalLockedMainCurrencyAmount: number | undefined
} => {
  // Derive account "assets"/assetAmount which include USD values using data from the assets slice
  const allAssetAmounts = assetAmounts
    .map<CompleteAssetAmount>((assetAmount) => {
      const assetPricePoint = selectAssetPricePoint(
        assets,
        assetAmount.asset,
        mainCurrencySymbol
      )

      const mainCurrencyEnrichedAssetAmount =
        enrichAssetAmountWithMainCurrencyValues(
          assetAmount,
          assetPricePoint,
          desiredDecimals.default
        )

      const fullyEnrichedAssetAmount = enrichAssetAmountWithDecimalValues(
        mainCurrencyEnrichedAssetAmount,
        heuristicDesiredDecimalsForUnitPrice(
          EXCEPTION_ASSETS_BY_SYMBOL.includes(
            assetAmount.asset.symbol.toUpperCase()
          )
            ? desiredDecimals.greater
            : desiredDecimals.default,
          mainCurrencyEnrichedAssetAmount.unitPrice
        )
      )

      return fullyEnrichedAssetAmount
    })
    .sort(compareCompleteAssets)

  const allLockedAssetAmounts = lockedAssetAmounts
    .map<CompleteAssetAmount>((assetAmount) => {
      const assetPricePoint = selectAssetPricePoint(
        assets,
        assetAmount.asset,
        mainCurrencySymbol
      )

      const mainCurrencyEnrichedAssetAmount =
        enrichAssetAmountWithMainCurrencyValues(
          assetAmount,
          assetPricePoint,
          desiredDecimals.default
        )

      const fullyEnrichedAssetAmount = enrichAssetAmountWithDecimalValues(
        mainCurrencyEnrichedAssetAmount,
        heuristicDesiredDecimalsForUnitPrice(
          EXCEPTION_ASSETS_BY_SYMBOL.includes(
            assetAmount.asset.symbol.toUpperCase()
          )
            ? desiredDecimals.greater
            : desiredDecimals.default,
          mainCurrencyEnrichedAssetAmount.unitPrice
        )
      )

      return fullyEnrichedAssetAmount
    })
    .sort(compareCompleteAssets)

  const { combinedAssetAmounts, unverifiedAssetAmounts } =
    allAssetAmounts.reduce<{
      combinedAssetAmounts: CompleteAssetAmount[]
      unverifiedAssetAmounts: CompleteAssetAmount[]
    }>(
      (acc, assetAmount) => {
        const { displayAsset, verifiedAsset } = determineAssetDisplayAndVerify(
          assetAmount,
          { hideDust, showUnverifiedAssets }
        )

        if (displayAsset) {
          if (verifiedAsset) {
            acc.combinedAssetAmounts.push(assetAmount)
          } else {
            acc.unverifiedAssetAmounts.push(assetAmount)
          }
        }
        return acc
      },
      { combinedAssetAmounts: [], unverifiedAssetAmounts: [] }
    )

  // Keep a tally of the total user value; undefined if no main currency data is available.
  let totalMainCurrencyAmount: number | undefined
  combinedAssetAmounts.forEach((assetAmount) => {
    if (typeof assetAmount.mainCurrencyAmount !== "undefined") {
      totalMainCurrencyAmount ??= 0 // initialize if needed
      totalMainCurrencyAmount += assetAmount.mainCurrencyAmount
    }
  })

  let totalLockedMainCurrencyAmount: number | undefined
  allLockedAssetAmounts.forEach((assetAmount) => {
    if (typeof assetAmount.mainCurrencyAmount !== "undefined") {
      totalLockedMainCurrencyAmount ??= 0 // initialize if needed
      totalLockedMainCurrencyAmount += assetAmount.mainCurrencyAmount
    }
  })

  return {
    allAssetAmounts,
    lockedAssetAmounts: allLockedAssetAmounts,
    combinedAssetAmounts,
    unverifiedAssetAmounts,
    totalMainCurrencyAmount,
    totalLockedMainCurrencyAmount,
  }
}

const getAccountState = (state: RootState) => state.account
const getCurrentAccountState = (state: RootState) => {
  const { address, network } = state.ui.selectedAccount
  return state.account.accountsData.evm[network.chainID]?.[address]
}
export const getAssetsState = (state: RootState): AssetsState => state.assets

export const selectCurrentAccountBalances = createSelector(
  getCurrentAccountState,
  getAssetsState,
  selectHideDust,
  selectShowUnverifiedAssets,
  selectMainCurrencySymbol,
  selectCurrentNetwork,
  (
    currentAccount,
    assets,
    hideDust,
    showUnverifiedAssets,
    mainCurrencySymbol,
    currentNetwork
  ) => {
    if (typeof currentAccount === "undefined" || currentAccount === "loading")
      return undefined

    const assetAmounts: AnyAssetAmount<AnyAsset>[] = []
    const lockedAssetAmounts: AnyAssetAmount<AnyAsset>[] = []

    Object.values(currentAccount.balances).forEach((balance) => {
      const { assetAmount, lockedAmount } = balance

      // Add spendable balance
      assetAmounts.push(assetAmount)

      // Add locked balance if it exists
      if (lockedAmount) {
        lockedAssetAmounts.push(lockedAmount)
      }
    })

    // Ensure pinned assets (WQI, WQUAI, USDT) are always present
    if (currentNetwork) {
      for (const symbol of ALWAYS_VISIBLE_SYMBOLS) {
        const pinnedAsset = assets.find(
          (a) =>
            a.symbol.toUpperCase() === symbol &&
            isSmartContractFungibleAsset(a) &&
            a.homeNetwork.chainID === currentNetwork.chainID
        )
        const hasBalance = Object.values(currentAccount.balances).some(
          (b) =>
            b.assetAmount.asset.symbol.toUpperCase() === symbol &&
            isSmartContractFungibleAsset(b.assetAmount.asset) &&
            b.assetAmount.asset.homeNetwork.chainID === currentNetwork.chainID
        )
        if (pinnedAsset && !hasBalance) {
          assetAmounts.push({ asset: pinnedAsset, amount: BigInt(0) })
        }
      }
    }

    const {
      allAssetAmounts,
      lockedAssetAmounts: allLockedAssetAmounts,
      combinedAssetAmounts,
      unverifiedAssetAmounts,
      totalMainCurrencyAmount,
      totalLockedMainCurrencyAmount,
    } = computeCombinedAssetAmountsData(
      assetAmounts,
      lockedAssetAmounts,
      assets,
      mainCurrencySymbol,
      hideDust,
      showUnverifiedAssets,
    )

    for (let i = 0; i < allAssetAmounts.length; i++) {
      let isInCombined = false
      const firstAsset = allAssetAmounts[i].asset
      if (isSmartContractFungibleAsset(firstAsset)) {
        for (let j = 0; j < combinedAssetAmounts.length; j++) {
          const secondAsset = combinedAssetAmounts[j].asset
          if (isSmartContractFungibleAsset(secondAsset)) {
            if (
              firstAsset.contractAddress === secondAsset.contractAddress &&
              firstAsset.symbol === secondAsset.symbol
            ) {
              isInCombined = true
            }
          }
        }
        if (
          !isInCombined &&
          getExtendedZoneForAddress(firstAsset.contractAddress, false) ===
            getExtendedZoneForAddress(currentAccount.address, false)
        ) {
          combinedAssetAmounts.push(allAssetAmounts[i])
        }
      }
    }

    return {
      allAssetAmounts,
      lockedAssetAmounts: allLockedAssetAmounts,
      assetAmounts: combinedAssetAmounts,
      unverifiedAssetAmounts,
      totalMainCurrencyValue: totalMainCurrencyAmount
        ? formatCurrencyAmount(
            mainCurrencySymbol,
            totalMainCurrencyAmount,
            desiredDecimals.default
          )
        : undefined,
      totalLockedMainCurrencyValue: totalLockedMainCurrencyAmount
        ? formatCurrencyAmount(
            mainCurrencySymbol,
            totalLockedMainCurrencyAmount,
            desiredDecimals.default
          )
        : undefined,
    }
  }
)

export type AccountTotal = AddressOnNetwork & {
  shortenedAddress: string
  accountType: AccountType
  signerId: string | null
  path: string | null
  accountSigner: AccountSigner
  name?: string
  shortName?: string
  avatarURL?: string
  localizedTotalMainCurrencyAmount?: string
  balance?: string
}

/**
 * Given an account signer, resolves a unique id for that signer. Returns null
 * for read-only accounts. This allows for grouping accounts together by the
 * signer that can provide signatures for those accounts.
 */
function signerIdFor(accountSigner: AccountSigner): string | null {
  switch (accountSigner.type) {
    case "private-key":
      return "private-key"
    case "keyring":
      return accountSigner.keyringID
    case "ledger":
      // Group Ledger accounts by device ID
      return `ledger-${accountSigner.deviceId}`
    case "read-only":
      return null
    default:
      return assertUnreachable(accountSigner)
  }
}

export type CategorizedAccountTotals = { [key in AccountType]?: AccountTotal[] }

const signerTypeToAccountType: Record<SignerType, AccountType> = {
  keyring: AccountType.Imported,
  "private-key": AccountType.PrivateKey,
  "read-only": AccountType.ReadOnly,
  "ledger": AccountType.Ledger,
}

const getAccountType = (
  address: string,
  signer: AccountSigner,
  addressSources: {
    [address: string]: SignerImportSource
  }
): AccountType => {
  switch (true) {
    case signerTypeToAccountType[signer.type] === AccountType.ReadOnly:
    case signerTypeToAccountType[signer.type] === AccountType.PrivateKey:
    case signerTypeToAccountType[signer.type] === AccountType.Ledger:
      return signerTypeToAccountType[signer.type]
    case addressSources[address] === SignerImportSource.import:
      return AccountType.Imported
    default:
      return AccountType.Internal
  }
}

const getTotalBalance = (
  accountBalances: { [assetSymbol: string]: AccountBalance },
  assets: AssetsState,
  mainCurrencySymbol: string
) => {
  return Object.values(accountBalances)
    .map(({ assetAmount }) => {
      const assetPricePoint = selectAssetPricePoint(
        assets,
        assetAmount.asset,
        mainCurrencySymbol
      )

      if (typeof assetPricePoint === "undefined") return 0

      const convertedAmount = convertAssetAmountViaPricePoint(
        assetAmount,
        assetPricePoint
      )
      if (typeof convertedAmount === "undefined") return 0

      return assetAmountToDesiredDecimals(
        convertedAmount,
        desiredDecimals.default
      )
    })
    .reduce((total, assetBalance) => total + assetBalance, 0)
}

function getNetworkAccountTotalsByCategory(
  state: RootState,
  network: NetworkInterface
): CategorizedAccountTotals {
  const accounts = getAccountState(state)
  const assets = getAssetsState(state)
  const accountSignersByAddress = selectAccountSignersByAddress(state)
  const keyringsByAddresses = selectKeyringsByAddresses(state)
  const sourcesByAddress = selectSourcesByAddress(state)
  const mainCurrencySymbol = selectMainCurrencySymbol(state)

  return Object.entries(accounts.accountsData.evm[network.chainID] ?? {})
    .filter(([, accountData]) => typeof accountData !== "undefined")
    .map(([address, accountData]): AccountTotal => {
      const shortenedAddress = truncateAddress(address)
      const accountSigner = accountSignersByAddress[address]
      const signerId = signerIdFor(accountSigner)
      const path = keyringsByAddresses[address]?.path

      const accountType = getAccountType(
        address,
        accountSigner,
        sourcesByAddress
      )

      if (accountData === "loading")
        return {
          address,
          network,
          shortenedAddress,
          accountType,
          signerId,
          path,
          accountSigner,
        }

      const shard = getExtendedZoneForAddress(address)
      const { customAccountData, defaultName, balances, defaultAvatar } =
        accountData
      const name = `${customAccountData.name ?? defaultName} (${shard})`
      const shortName = customAccountData.name ?? defaultName
      const balanceAmount = balances.QUAI
        ? parseFloat(convertToEth(balances.QUAI.assetAmount.amount)).toFixed(4)
        : "0"
      const balance = `${balanceAmount} QUAI`
      const localizedTotalMainCurrencyAmount = formatCurrencyAmount(
        mainCurrencySymbol,
        getTotalBalance(balances, assets, mainCurrencySymbol),
        desiredDecimals.default
      )

      return {
        shortName,
        address,
        network,
        shortenedAddress,
        accountType,
        signerId,
        path,
        accountSigner,
        name,
        avatarURL: defaultAvatar,
        localizedTotalMainCurrencyAmount,
        balance,
      }
    })
    .reduce<CategorizedAccountTotals>(
      (seenTotalsByType, accountTotal) => ({
        ...seenTotalsByType,
        [accountTotal.accountType]: [
          ...(seenTotalsByType[accountTotal.accountType] ?? []),
          accountTotal,
        ],
      }),
      {}
    )
}

const selectNetworkAccountTotalsByCategoryResolver = createSelector(
  (state: RootState) => state,
  (state) => (network: NetworkInterface) => {
    return getNetworkAccountTotalsByCategory(state, network)
  }
)

export const selectCurrentNetworkAccountTotalsByCategory = createSelector(
  selectNetworkAccountTotalsByCategoryResolver,
  selectCurrentNetwork,
  (
    selectNetworkAccountTotalsByCategory,
    currentNetwork
  ): CategorizedAccountTotals => {
    return selectNetworkAccountTotalsByCategory(currentNetwork)
  }
)

function findAccountTotal(
  categorizedAccountTotals: CategorizedAccountTotals,
  accountAddressOnNetwork: AddressOnNetwork
): AccountTotal | undefined {
  return Object.values(categorizedAccountTotals)
    .flat()
    .find(
      ({ address, network }) =>
        sameQuaiAddress(address, accountAddressOnNetwork.address) &&
        sameNetwork(network, accountAddressOnNetwork.network)
    )
}

export const getAccountTotal = (
  state: RootState,
  accountAddressOnNetwork: AddressOnNetwork
): AccountTotal | undefined =>
  findAccountTotal(
    selectNetworkAccountTotalsByCategoryResolver(state)(
      accountAddressOnNetwork.network
    ),
    accountAddressOnNetwork
  )

export const selectCurrentAccountTotal = createSelector(
  selectCurrentNetworkAccountTotalsByCategory,
  selectCurrentAccount,
  (categorizedAccountTotals, currentAccount): AccountTotal | undefined =>
    findAccountTotal(categorizedAccountTotals, currentAccount)
)

export const getAllAddresses = createSelector(getAccountState, (account) => {
  return account
    ? [
        ...new Set(
          Object.values(account.accountsData.evm).flatMap((chainAddresses) =>
            Object.keys(chainAddresses)
          )
        ),
      ]
    : []
})

export const getAddressCount = createSelector(
  getAllAddresses,
  (allAddresses) => allAddresses.length
)

export const getAllAccounts = createSelector(getAccountState, (account) => {
  return account
    ? [
        ...new Set(
          Object.values(account.accountsData.evm).flatMap((chainAddresses) =>
            Object.values(chainAddresses)
          )
        ),
      ]
    : []
})

export const selectQiCoinbaseAddresses = createSelector(
  getAccountState,
  (account) => {
    return account?.qiCoinbaseAddresses ?? []
  }
)

export const selectIsQiWalletInit = createSelector(
  (state: RootState) => state.keyrings.qiHDWallet,
  (qiHdWallet) => {
    return !!qiHdWallet
  }
)
