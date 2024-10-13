import { createSlice } from "@reduxjs/toolkit"
import { Zone } from "quais"
import { createBackgroundAsyncThunk } from "./utils"
import {
  AccountBalance,
  AddressOnNetwork,
  NameOnNetwork,
  QiCoinbaseAddress,
  QiWalletBalance,
} from "../accounts"
import {
  AnyAsset,
  AnyAssetAmount,
  isFungibleAsset,
  isSmartContractFungibleAsset,
  SmartContractFungibleAsset,
} from "../assets"
import {
  AssetMainCurrencyAmount,
  AssetDecimalAmount,
  isBuiltInNetworkBaseAsset,
  isSameAsset,
} from "./utils/asset-utils"
import { DomainName, HexString } from "../types"
import { sameQuaiAddress } from "../lib/utils"
import { AccountSigner } from "../services/signing"
import { TEST_NETWORK_BY_CHAIN_ID } from "../constants"
import { convertFixedPoint } from "../lib/fixed-point"
import { NetworkInterface } from "../constants/networks/networkTypes"
import { QiWallet } from "../services/keyring/types"
import { RootState } from "./index"
import { updateSelectedUtxoAccountBalance } from "./ui"

/**
 * The set of available UI account types. These may or may not map 1-to-1 to
 * internal account types, depending on how the UI chooses to display data.
 */
export const enum AccountType {
  ReadOnly = "read-only",
  PrivateKey = "private-key",
  Imported = "imported",
  Internal = "internal",
}

export const ACCOUNT_TYPES = [
  AccountType.Internal,
  AccountType.Imported,
  AccountType.PrivateKey,
  AccountType.ReadOnly,
]

export const DEFAULT_ACCOUNT_NAMES = [
  "Nautilus",
  "Poseidon",
  "Compass",
  "Calypso",
  "Marina",
  "Siren",
  "Endeavour",
  "Yawl",
]

const availableDefaultNames = [...DEFAULT_ACCOUNT_NAMES]

export type ListAccount = {
  address: string
  defaultAvatar: string
  defaultName: string
  shard: string
}

export type EvmAccountData = {
  address: HexString
  network: NetworkInterface
  balances: {
    [assetSymbol: string]: AccountBalance
  }
  customAccountData: {
    name?: DomainName
  }
  defaultName: string
  defaultAvatar: string
}

type EvmAccountsByChainID = {
  [chainID: string]: {
    [address: string]: EvmAccountData | "loading"
  }
}

type UtxoAccountsByChainID = {
  [chainID: string]: {
    [paymentCode: string]: UtxoAccountData | null
  }
}

export type UtxoAccountData = {
  paymentCode: HexString
  id: string
  addresses: string[]
  network: NetworkInterface
  balances: { [zone: string]: QiWalletBalance }
  defaultName: string
  defaultAvatar: string
}

export type AccountState = {
  account?: AddressOnNetwork
  accountLoading?: string
  hasAccountError?: boolean
  accountsData: {
    evm: EvmAccountsByChainID
    utxo: UtxoAccountsByChainID
  }
  combinedData: CombinedAccountData
  qiCoinbaseAddresses: QiCoinbaseAddress[]
}

export type CombinedAccountData = {
  totalMainCurrencyValue?: string
  assets: AnyAssetAmount[]
}

// Utility type, wrapped in CompleteAssetAmount<T>.
type InternalCompleteAssetAmount<
  E extends AnyAsset = AnyAsset,
  T extends AnyAssetAmount<E> = AnyAssetAmount<E>
> = T & AssetMainCurrencyAmount & AssetDecimalAmount

/**
 * An asset amount including localized and numeric main currency and decimal
 * equivalents, where applicable.
 */
export type CompleteAssetAmount<T extends AnyAsset = AnyAsset> =
  InternalCompleteAssetAmount<T, AnyAssetAmount<T>>

const initialState: AccountState = {
  accountsData: { evm: {}, utxo: {} },
  combinedData: {
    totalMainCurrencyValue: "",
    assets: [],
  },
  qiCoinbaseAddresses: [],
}

function newAccountData(
  address: HexString,
  network: NetworkInterface,
  accountsState: AccountState
): EvmAccountData {
  const existingAccountsCount = Object.keys(
    accountsState.accountsData.evm[network.chainID]
  ).filter((key) => key !== address).length

  const sameAccountOnDifferentChain = Object.values(
    accountsState.accountsData.evm
  )
    .flatMap((chain) => Object.values(chain))
    .find(
      (accountData): accountData is EvmAccountData =>
        accountData !== "loading" && accountData.address === address
    )
  const defaultNameIndex =
    // Skip potentially-used names at the beginning of the array if relevant
    (existingAccountsCount % availableDefaultNames.length) +
    Number(
      // Treat the address as a number and mod it to get an index into default names.
      BigInt(address) %
        BigInt(
          availableDefaultNames.length -
            (existingAccountsCount % availableDefaultNames.length)
        )
    )

  let defaultAccountName = sameAccountOnDifferentChain?.defaultName
  if (typeof defaultAccountName === "undefined") {
    defaultAccountName = availableDefaultNames[defaultNameIndex]
    // Move used default names to the start so they can be skipped above.
    availableDefaultNames.splice(defaultNameIndex, 1)
    availableDefaultNames.unshift(defaultAccountName)
  }

  const defaultAccountAvatar = `./images/avatars/${defaultAccountName.toLowerCase()}@2x.png`

  return {
    address,
    network,
    balances: {},
    customAccountData: {},
    defaultName: defaultAccountName,
    defaultAvatar: defaultAccountAvatar,
  }
}

function updateCombinedData(immerState: AccountState) {
  // A key assumption here is that the balances of two accounts in
  // accountsData are mutually exclusive; that is, that there are no two
  // accounts in accountsData all or part of whose balances are shared with
  // each other.
  const filteredEvm = Object.keys(immerState.accountsData.evm)
    .filter((key) => !TEST_NETWORK_BY_CHAIN_ID.has(key))
    .reduce<EvmAccountsByChainID>((evm, key) => {
      return {
        ...evm,
        [key]: immerState.accountsData.evm[key],
      }
    }, {})

  const combinedAccountBalances = Object.values(filteredEvm)
    .flatMap((accountDataByChain) => Object.values(accountDataByChain))
    .flatMap((ad) =>
      ad === "loading"
        ? []
        : Object.values(ad.balances).map((ab) => ab.assetAmount)
    )

  immerState.combinedData.assets = Object.values(
    combinedAccountBalances.reduce<{
      [symbol: string]: AnyAssetAmount
    }>((acc, combinedAssetAmount) => {
      const assetSymbol = combinedAssetAmount.asset.symbol
      let { amount } = combinedAssetAmount

      if (acc[assetSymbol]?.asset) {
        const accAsset = acc[assetSymbol].asset
        const existingDecimals = isFungibleAsset(accAsset)
          ? accAsset.decimals
          : 0
        const newDecimals = isFungibleAsset(combinedAssetAmount.asset)
          ? combinedAssetAmount.asset.decimals
          : 0

        if (newDecimals !== existingDecimals) {
          amount = convertFixedPoint(amount, newDecimals, existingDecimals)
        }
      }

      if (acc[assetSymbol]) {
        acc[assetSymbol].amount += amount
      } else {
        acc[assetSymbol] = {
          ...combinedAssetAmount,
        }
      }
      return acc
    }, {})
  )
}

function getOrCreateAccountData(
  accountState: AccountState,
  account: HexString,
  network: NetworkInterface
): EvmAccountData {
  const accountData = accountState.accountsData.evm[network.chainID][account]

  if (accountData === "loading" || !accountData)
    return newAccountData(account, network, accountState)

  return accountData
}

// TODO Much of the combinedData bits should probably be done in a Reselect
const accountSlice = createSlice({
  name: "account",
  initialState,
  reducers: {
    loadAccount: (
      immerState,
      { payload: { address, network } }: { payload: AddressOnNetwork }
    ) => {
      if (immerState.accountsData.evm[network.chainID]?.[address] !== undefined)
        return

      immerState.accountsData.evm[network.chainID] ??= {}

      immerState.accountsData.evm[network.chainID] = {
        ...immerState.accountsData.evm[network.chainID],
        [address]: "loading",
      }
    },
    loadUtxoAccount: (
      immerState,
      {
        payload: { qiWallet, network },
      }: { payload: { qiWallet: QiWallet | null; network: NetworkInterface } }
    ) => {
      if (!qiWallet) return

      const { paymentCode, id, addresses } = qiWallet

      if (immerState.accountsData.utxo[network.chainID]?.[paymentCode]) return

      immerState.accountsData.utxo[network.chainID] = {
        ...immerState.accountsData.utxo[network.chainID],
        [paymentCode]: {
          paymentCode,
          network,
          balances: {},
          defaultName: "Cyprus 1",
          defaultAvatar: "./images/avatars/compass@2x.png",
          id,
          addresses,
        },
      }
    },
    deleteAccount: (
      immerState,
      { payload: address }: { payload: HexString }
    ) => {
      const { evm } = immerState.accountsData

      if (
        !Object.keys(evm ?? {}).some((chainID) =>
          Object.keys(evm[chainID]).some(
            (addressOnChain) => addressOnChain === address
          )
        )
      )
        return // If none of the chains we're tracking has a matching address - this is a noop.

      // Delete the account from all chains.
      Object.keys(evm).forEach((chainId) => {
        const { [address]: _, ...withoutEntryToRemove } = evm[chainId]
        immerState.accountsData.evm[chainId] = withoutEntryToRemove
      })

      updateCombinedData(immerState)
    },
    updateUtxoAccountBalance: (
      immerState,
      {
        payload: { balances },
      }: {
        payload: {
          balances: QiWalletBalance[]
        }
      }
    ) => {
      balances.forEach((balance) => {
        const { paymentCode, network } = balance
        const account =
          immerState.accountsData.utxo[network.chainID]?.[paymentCode]
        if (!account) return

        account.balances[Zone.Cyprus1] = balance
      })
    },
    updateAccountBalance: (
      immerState,
      {
        payload: { balances },
      }: {
        payload: {
          balances: AccountBalance[]
          addressOnNetwork: AddressOnNetwork
        }
      }
    ) => {
      balances.forEach((updatedAccountBalance) => {
        const {
          address,
          network,
          assetAmount: { asset },
        } = updatedAccountBalance
        const { symbol: updatedAssetSymbol } = asset

        const existingAccountData =
          immerState.accountsData.evm[network.chainID]?.[address]

        // Don't upsert, only update existing account entries.
        if (existingAccountData === undefined) return

        if (existingAccountData !== "loading") {
          if (
            updatedAccountBalance.assetAmount.amount === 0n &&
            existingAccountData.balances[updatedAssetSymbol] === undefined &&
            !isBuiltInNetworkBaseAsset(asset, network) // add base asset even if balance is 0
          )
            return

          existingAccountData.balances[updatedAssetSymbol] =
            updatedAccountBalance
        } else {
          immerState.accountsData.evm[network.chainID][address] = {
            // TODO Figure out the best way to handle default name assignment
            // TODO across networks.
            ...newAccountData(address, network, immerState),
            balances: {
              [updatedAssetSymbol]: updatedAccountBalance,
            },
          }
        }
      })

      updateCombinedData(immerState)
    },
    updateAccountName: (
      immerState,
      {
        payload: { address, network, name },
      }: { payload: AddressOnNetwork & { name: DomainName } }
    ) => {
      // No entry means this name doesn't correspond to an account we are tracking.
      if (immerState.accountsData.evm[network.chainID]?.[address] === undefined)
        return

      immerState.accountsData.evm[network.chainID] ??= {}

      const baseAccountData = getOrCreateAccountData(
        // TODO Figure out the best way to handle default name assignment
        // TODO across networks.
        immerState,
        address,
        network
      )

      immerState.accountsData.evm[network.chainID][address] = {
        ...baseAccountData,
        customAccountData: { ...baseAccountData.customAccountData, name },
      }
    },
    /**
     * Updates cached SmartContracts metadata
     */
    updateAssetReferences: (
      immerState,
      { payload: asset }: { payload: SmartContractFungibleAsset }
    ) => {
      const allAccounts = immerState.accountsData.evm[asset.homeNetwork.chainID]
      Object.keys(allAccounts).forEach((address) => {
        const account = allAccounts[address]
        if (account !== "loading") {
          Object.values(account.balances).forEach(({ assetAmount }) => {
            if (
              isSmartContractFungibleAsset(assetAmount.asset) &&
              sameQuaiAddress(
                assetAmount.asset.contractAddress,
                asset.contractAddress
              )
            ) {
              Object.assign(assetAmount.asset, asset)
            }
          })
        }
      })

      updateCombinedData(immerState)
    },
    removeAssetReferences: (
      immerState,
      { payload: asset }: { payload: SmartContractFungibleAsset }
    ) => {
      const allAccounts = immerState.accountsData.evm[asset.homeNetwork.chainID]
      Object.keys(allAccounts).forEach((address) => {
        const account = allAccounts[address]
        if (account !== "loading") {
          Object.values(account.balances).forEach(({ assetAmount }) => {
            if (isSameAsset(assetAmount.asset, asset)) {
              delete account.balances[assetAmount.asset.symbol]
            }
          })
        }
      })

      updateCombinedData(immerState)
    },
    removeChainBalances: (
      immerState,
      { payload: chainID }: { payload: string }
    ) => {
      delete immerState.accountsData.evm[chainID]
    },
    updateQiCoinbaseAddress: (
      immerState,
      { payload: address }: { payload: QiCoinbaseAddress }
    ) => {
      immerState.qiCoinbaseAddresses = [
        ...immerState.qiCoinbaseAddresses,
        address,
      ]
    },
  },
})

export const {
  deleteAccount,
  loadAccount,
  loadUtxoAccount,
  updateUtxoAccountBalance,
  updateAccountBalance,
  updateAccountName,
  updateAssetReferences,
  removeAssetReferences,
  removeChainBalances,
  updateQiCoinbaseAddress,
} = accountSlice.actions

export default accountSlice.reducer

/**
 * Async thunk whose dispatch promise will return a resolved name or undefined
 * if the name cannot be resolved.
 */
export const resolveNameOnNetwork = createBackgroundAsyncThunk(
  "account/resolveNameOnNetwork",
  async (nameOnNetwork: NameOnNetwork, { extra: { main } }) => {
    return main.resolveNameOnNetwork(nameOnNetwork)
  }
)

/**
 * Async thunk whose dispatch promise will return when the account has been
 * added.
 *
 * Actual account data will flow into the redux store through other channels;
 * the promise returned from this action's dispatch will be fulfilled by a void
 * value.
 */
export const addAddressNetwork = createBackgroundAsyncThunk(
  "account/addAccount",
  async (addressNetwork: AddressOnNetwork, { dispatch, extra: { main } }) => {
    const normalizedAddressNetwork = {
      address: addressNetwork.address,
      network: addressNetwork.network,
    }

    dispatch(loadAccount(normalizedAddressNetwork))
    await main.addAccount(normalizedAddressNetwork)
  }
)

export const addOrEditAddressName = createBackgroundAsyncThunk(
  "account/addOrEditAddressName",
  async (payload: AddressOnNetwork & { name: string }, { extra: { main } }) => {
    await main.addOrEditAddressName(payload)
  }
)

export const removeAccount = createBackgroundAsyncThunk(
  "account/removeAccount",
  async (
    payload: {
      addressOnNetwork: AddressOnNetwork
      signer: AccountSigner
      lastAddressInAccount: boolean
    },
    { extra: { main } }
  ) => {
    const { addressOnNetwork, signer, lastAddressInAccount } = payload

    await main.removeAccount(
      addressOnNetwork.address,
      signer,
      lastAddressInAccount
    )
  }
)

export const updateUtxoAccountsBalances = createBackgroundAsyncThunk(
  "account/updateUtxoAccountsBalances",
  async (
    payload: {
      balances: QiWalletBalance[]
    },
    { dispatch, getState }
  ) => {
    dispatch(updateUtxoAccountBalance(payload))

    const state = getState() as RootState
    const selectedUtxoAcc = state.ui.selectedUtxoAccount
    if (!selectedUtxoAcc) return
    const balanceForSelectedUtxoAcc = payload.balances.find(
      (balance) => balance.paymentCode === selectedUtxoAcc.paymentCode
    )
    if (!balanceForSelectedUtxoAcc) return

    dispatch(updateSelectedUtxoAccountBalance(balanceForSelectedUtxoAcc))
  }
)

export const addQiCoinbaseAddress = createBackgroundAsyncThunk(
  "account/addQiCoinbaseAddress",
  async (
    payload: {
      zone: Zone
    },
    { dispatch, extra: { main } }
  ) => {
    const { address, account, index, zone } = await main.addQiCoinbaseAddress(
      payload.zone
    )
    dispatch(
      updateQiCoinbaseAddress({
        address,
        account,
        index,
        zone,
      })
    )
  }
)
