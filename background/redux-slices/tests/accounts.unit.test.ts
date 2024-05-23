import { cloneDeep } from "lodash"
import { AccountBalance } from "../../accounts"
import { SmartContractFungibleAsset } from "../../assets"
import { QUAI, QUAI_NETWORK } from "../../constants"
import {
  createAccountData,
  createAddressOnNetwork,
  createCompleteAssetAmount,
  createNetworkBaseAsset,
  createSmartContractAsset,
} from "../../tests/factories"
import reducer, {
  AccountData,
  AccountState,
  updateAccountBalance,
  updateAssetReferences,
} from "../accounts"
import { determineAssetDisplayAndVerify } from "../selectors"

const ADDRESS_MOCK = "0x208e94d5661a73360d9387d3ca169e5c130090cd"
const ACCOUNT_MOCK = {
  address: ADDRESS_MOCK,
  network: QUAI_NETWORK,
  balances: {},
  ens: {},
  defaultName: "Topa",
  defaultAvatar: "",
}
const ASSET_MOCK: SmartContractFungibleAsset = createSmartContractAsset({
  symbol: "XYZ",
})
const BALANCE_MOCK: AccountBalance = {
  address: ADDRESS_MOCK,
  assetAmount: {
    asset: QUAI,
    amount: 1n,
  },
  network: QUAI_NETWORK,
  retrievedAt: 1,
  dataSource: "local",
}

describe("Accounts redux slice", () => {
  describe(updateAccountBalance, () => {
    let state: AccountState

    beforeEach(() => {
      state = {
        accountsData: { evm: {} },
        combinedData: {
          totalMainCurrencyValue: "",
          assets: [],
        },
      }
    })

    it("should update positive balance for account that is loading", () => {
      const balances = [BALANCE_MOCK]
      state.accountsData.evm = {
        [QUAI_NETWORK.chainID]: { [ADDRESS_MOCK]: "loading" },
      }
      const updated = reducer(
        state,
        updateAccountBalance({
          balances,
          addressOnNetwork: { address: ADDRESS_MOCK, network: QUAI_NETWORK },
        })
      )

      const updatedAccountData =
        updated.accountsData.evm[QUAI_NETWORK.chainID][ADDRESS_MOCK]

      expect(updatedAccountData).not.toEqual("loading")

      const updatedBalance = (updatedAccountData as AccountData)?.balances
      expect(updatedBalance?.[QUAI.symbol].assetAmount.amount).toBe(1n)
      expect(updated.combinedData.totalMainCurrencyValue).toBe("")
    })

    it("should update positive balance for account that is loaded", () => {
      const balances = [BALANCE_MOCK]
      state.accountsData.evm = {
        [QUAI_NETWORK.chainID]: { [ADDRESS_MOCK]: ACCOUNT_MOCK },
      }
      const updated = reducer(
        state,
        updateAccountBalance({
          balances,
          addressOnNetwork: { address: ADDRESS_MOCK, network: QUAI_NETWORK },
        })
      )
      const updatedAccountData =
        updated.accountsData.evm[QUAI_NETWORK.chainID][ADDRESS_MOCK]
      const updatedBalance = (updatedAccountData as AccountData)?.balances

      expect(updatedBalance?.[QUAI.symbol].assetAmount.amount).toBe(1n)
      expect(updated.combinedData.totalMainCurrencyValue).toBe("")
    })

    it("should updated zero balance for account that is loading", () => {
      const balances: AccountBalance[] = [
        {
          ...BALANCE_MOCK,
          assetAmount: {
            asset: QUAI,
            amount: 0n,
          },
        },
      ]
      state.accountsData.evm = {
        [QUAI_NETWORK.chainID]: { [ADDRESS_MOCK]: "loading" },
      }
      const updated = reducer(
        state,
        updateAccountBalance({
          balances,
          addressOnNetwork: { address: ADDRESS_MOCK, network: QUAI_NETWORK },
        })
      )

      const updatedAccountData =
        updated.accountsData.evm[QUAI_NETWORK.chainID][ADDRESS_MOCK]

      expect(updatedAccountData).not.toEqual("loading")

      const updatedBalance = (updatedAccountData as AccountData)?.balances
      expect(updatedBalance?.[QUAI.symbol].assetAmount.amount).toBe(0n)
    })

    it("should update zero balance for account that is loaded", () => {
      const balances: AccountBalance[] = [
        {
          ...BALANCE_MOCK,
          assetAmount: {
            asset: QUAI,
            amount: 0n,
          },
        },
      ]
      state.accountsData.evm = {
        [QUAI_NETWORK.chainID]: { [ADDRESS_MOCK]: ACCOUNT_MOCK },
      }
      const updated = reducer(
        state,
        updateAccountBalance({
          balances,
          addressOnNetwork: { address: ADDRESS_MOCK, network: QUAI_NETWORK },
        })
      )
      const updatedAccountData =
        updated.accountsData.evm[QUAI_NETWORK.chainID][ADDRESS_MOCK]
      const updatedBalance = (updatedAccountData as AccountData)?.balances

      expect(updatedBalance?.[QUAI.symbol].assetAmount.amount).toBe(0n)
    })

    it("should update positive balance multiple times", () => {
      state.accountsData.evm = {
        [QUAI_NETWORK.chainID]: { [ADDRESS_MOCK]: ACCOUNT_MOCK },
      }

      const initial = reducer(
        state,
        updateAccountBalance({
          balances: [
            BALANCE_MOCK,
            { ...BALANCE_MOCK, assetAmount: { asset: ASSET_MOCK, amount: 5n } },
          ],
          addressOnNetwork: { address: ADDRESS_MOCK, network: QUAI_NETWORK },
        })
      )
      const updated = reducer(
        initial,
        updateAccountBalance({
          balances: [
            {
              ...BALANCE_MOCK,
              assetAmount: { asset: ASSET_MOCK, amount: 10n },
            },
          ],
          addressOnNetwork: { address: ADDRESS_MOCK, network: QUAI_NETWORK },
        })
      )

      const updatedAccountData =
        updated.accountsData.evm[QUAI_NETWORK.chainID][ADDRESS_MOCK]
      const updatedBalance = (updatedAccountData as AccountData)?.balances

      expect(updatedBalance?.[QUAI.symbol].assetAmount.amount).toBe(1n)
      expect(updatedBalance?.[ASSET_MOCK.symbol].assetAmount.amount).toBe(10n)
    })

    it("updates cached asset data for all accounts", () => {
      const asset = createSmartContractAsset()
      const otherAccount = createAddressOnNetwork()
      state.accountsData.evm = {
        [QUAI_NETWORK.chainID]: {
          [ADDRESS_MOCK]: ACCOUNT_MOCK,
          [otherAccount.address]: createAccountData({
            address: otherAccount.address,
          }),
        },
      }

      const firstAccountUpdate = reducer(
        state,
        updateAccountBalance({
          balances: [
            {
              ...BALANCE_MOCK,
              assetAmount: { asset, amount: 10n },
            },
          ],
          addressOnNetwork: { address: ADDRESS_MOCK, network: QUAI_NETWORK },
        })
      )

      const secondAccountUpdate = reducer(
        firstAccountUpdate,
        updateAccountBalance({
          balances: [
            {
              ...BALANCE_MOCK,
              address: otherAccount.address,
              assetAmount: { asset, amount: 10n },
            },
          ],
          addressOnNetwork: {
            address: otherAccount.address,
            network: QUAI_NETWORK,
          },
        })
      )

      const firstAccountData = secondAccountUpdate.accountsData.evm[
        QUAI_NETWORK.chainID
      ][ADDRESS_MOCK] as AccountData

      const secondAccountData = secondAccountUpdate.accountsData.evm[
        QUAI_NETWORK.chainID
      ][otherAccount.address] as AccountData

      expect(
        firstAccountData.balances[asset.symbol].assetAmount.asset.metadata
          ?.verified
      ).not.toBeDefined()
      expect(
        secondAccountData.balances[asset.symbol].assetAmount.asset.metadata
          ?.verified
      ).not.toBeDefined()

      const updatedAsset = cloneDeep(asset)
      updatedAsset.metadata ??= {}
      updatedAsset.metadata.verified = true

      const newState = reducer(
        secondAccountUpdate,
        updateAssetReferences(updatedAsset)
      )

      const updatedFirstAccountData = newState.accountsData.evm[
        QUAI_NETWORK.chainID
      ][ADDRESS_MOCK] as AccountData

      const updatedSecondAccountData = newState.accountsData.evm[
        QUAI_NETWORK.chainID
      ][otherAccount.address] as AccountData

      expect(
        updatedFirstAccountData.balances[asset.symbol].assetAmount.asset
          .metadata?.verified
      ).toBe(true)
      expect(
        updatedSecondAccountData.balances[asset.symbol].assetAmount.asset
          .metadata?.verified
      ).toBe(true)
    })
  })
})

describe("Utilities", () => {
  describe("determineAssetDisplayAndVerify", () => {
    it("should always display base assets", () => {
      const { displayAsset } = determineAssetDisplayAndVerify(
        createCompleteAssetAmount(createNetworkBaseAsset(), 0, {
          decimalAmount: 0,
          mainCurrencyAmount: 0,
        }),
        {
          hideDust: true,
          showUnverifiedAssets: false,
        }
      )
      expect(displayAsset).toBe(true)
    })

    describe("Hide dust", () => {
      it("should display asset amount if NOT dust and hideDust is enabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(createSmartContractAsset(), 200, {
            decimalAmount: 200,
            mainCurrencyAmount: 200,
          }),
          {
            hideDust: true,
            showUnverifiedAssets: false,
          }
        )

        expect(displayAsset).toBe(true)
      })

      it("should display asset amount if NOT dust and hideDust is disabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(createSmartContractAsset(), 200, {
            decimalAmount: 200,
            mainCurrencyAmount: 200,
          }),
          {
            hideDust: false,
            showUnverifiedAssets: false,
          }
        )

        expect(displayAsset).toBe(true)
      })

      it("should display asset amount if dust and hideDust is disabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(createSmartContractAsset(), 0, {
            decimalAmount: 1,
            mainCurrencyAmount: 0,
          }),
          {
            hideDust: false,
            showUnverifiedAssets: false,
          }
        )

        expect(displayAsset).toBe(true)
      })

      it("should NOT display asset amount if dust and hideDust is enabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(createSmartContractAsset(), 0, {
            decimalAmount: 0,
            mainCurrencyAmount: 0,
          }),
          {
            hideDust: true,
            showUnverifiedAssets: false,
          }
        )

        expect(displayAsset).toBe(false)
      })
    })

    describe("Verified assets", () => {
      it("should display asset amount if verified and showUnverifiedAssets is disabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(
            createSmartContractAsset({ metadata: { verified: true } }),
            200,
            {
              decimalAmount: 200,
              mainCurrencyAmount: 200,
            }
          ),
          {
            hideDust: true,
            showUnverifiedAssets: false,
          }
        )

        expect(displayAsset).toBe(true)
      })

      it("should display asset amount if verified and showUnverifiedAssets is enabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(
            createSmartContractAsset({ metadata: { verified: true } }),
            200,
            {
              decimalAmount: 200,
              mainCurrencyAmount: 200,
            }
          ),
          {
            hideDust: true,
            showUnverifiedAssets: true,
          }
        )

        expect(displayAsset).toBe(true)
      })

      it("should NOT display asset amount if unverified (trusted value set to false) and showUnverifiedAssets is disabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(
            createSmartContractAsset({ metadata: { verified: false } }),
            200,
            {
              decimalAmount: 200,
              mainCurrencyAmount: 200,
            }
          ),
          {
            hideDust: true,
            showUnverifiedAssets: false,
          }
        )

        expect(displayAsset).toBe(false)
      })

      it("should NOT display asset amount if unverified (empty metadata) and showUnverifiedAssets is disabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(
            createSmartContractAsset({ metadata: {} }),
            200,
            {
              decimalAmount: 200,
              mainCurrencyAmount: 200,
            }
          ),
          {
            hideDust: true,
            showUnverifiedAssets: false,
          }
        )

        expect(displayAsset).toBe(false)
      })

      it("should display asset amount if unverified and showUnverifiedAssets is enabled", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(
            createSmartContractAsset({ metadata: { verified: false } }),
            200,
            {
              decimalAmount: 200,
              mainCurrencyAmount: 200,
            }
          ),
          {
            hideDust: true,
            showUnverifiedAssets: true,
          }
        )

        expect(displayAsset).toBe(true)
      })

      it("should NOT display asset amount if verified and dust", () => {
        const { displayAsset } = determineAssetDisplayAndVerify(
          createCompleteAssetAmount(
            createSmartContractAsset({ metadata: { verified: true } }),
            0,
            {
              decimalAmount: 0,
              mainCurrencyAmount: 0,
            }
          ),
          {
            hideDust: true,
            showUnverifiedAssets: false,
          }
        )

        expect(displayAsset).toBe(false)
      })
    })
  })
})
