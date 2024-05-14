import { ETHEREUM } from "@pelagus/pelagus-background/constants"
import { normalizeEVMAddress } from "@pelagus/pelagus-background/lib/utils"
import { AccountState } from "@pelagus/pelagus-background/redux-slices/accounts"
import { createAccountData } from "@pelagus/pelagus-background/tests/factories"

export const TEST_ADDRESS = normalizeEVMAddress(
  "0x208e94d5661a73360d9387d3ca169e5c130090cd"
)

export const createAccountState = (
  overrides: Partial<AccountState> = {}
): AccountState => {
  return {
    accountsData: {
      evm: {
        [ETHEREUM.chainID]: {
          [TEST_ADDRESS]: {
            ...createAccountData(),
          },
        },
      },
    },
    combinedData: {
      totalMainCurrencyValue: "",
      assets: [],
    },
    ...overrides,
  }
}
