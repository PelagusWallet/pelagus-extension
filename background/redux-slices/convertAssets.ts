import { createSlice } from "@reduxjs/toolkit"
import { isUtxoAccountTypeGuard } from "@pelagus/pelagus-ui/utils/accounts"
import { Zone, formatQi, formatQuai, parseQi, parseQuai, quais } from "quais"
import { AccountTotal } from "./selectors"
import { createBackgroundAsyncThunk } from "./utils"
import { RootState } from "./index"
import { UtxoAccountData } from "./accounts"

export type ConvertAssetsState = {
  from: UtxoAccountData | AccountTotal | null
  to: UtxoAccountData | AccountTotal | null
  amount: string
  rate: number
  expectedResult: number
  expectedSlippage: number
  maxSlippage: number
  wrappedQiDeposit: bigint
}

const initialState: ConvertAssetsState = {
  from: null,
  to: null,
  amount: "",
  rate: 0,
  expectedResult: 0,
  expectedSlippage: 0,
  maxSlippage: 100, // Default 1% (in basis points)
  wrappedQiDeposit: BigInt(0)
}

const convertAssetsSlice = createSlice({
  name: "convertAssets",
  initialState,
  reducers: {
    setConvertAmount: (immerState, { payload }: { payload: string }) => {
      immerState.amount = payload
    },
    setConvertFrom: (
      immerState,
      { payload }: { payload: UtxoAccountData | AccountTotal }
    ) => {
      immerState.from = payload
    },
    setConvertTo: (
      immerState,
      { payload }: { payload: UtxoAccountData | AccountTotal }
    ) => {
      immerState.to = payload
    },
    setConvertRate: (immerState, { payload }: { payload: number }) => {
      immerState.rate = payload
    },
    setConvertExpectedResult: (
      immerState,
      { payload }: { payload: number }
    ) => {
      immerState.expectedResult = payload
    },
    setConvertExpectedSlippage: (
      immerState,
      { payload }: { payload: number }
    ) => {
      immerState.expectedSlippage = payload
    },
    setMaxSlippage: (immerState, { payload }: { payload: number }) => {
      immerState.maxSlippage = payload
    },
    updateQuaiAccountInConversionDestination: (
      immerState,
      { payload }: { payload: AccountTotal }
    ) => {
      if (immerState.to && isUtxoAccountTypeGuard(immerState.to)) {
        immerState.from = payload
        return
      }

      immerState.to = payload
    },
    setWrappedQiDeposit: (immerState, { payload }: { payload: bigint }) => {
      immerState.wrappedQiDeposit = payload
    },
    resetConvertAssetsSlice: (immerState) => {
      immerState.from = null
      immerState.to = null
      immerState.amount = ""
      immerState.rate = 0
      immerState.maxSlippage = 100 // Reset to default 1%
      immerState.wrappedQiDeposit = BigInt(0)
    },
  },
})

export const {
  setConvertAmount,
  setConvertFrom,
  setConvertTo,
  updateQuaiAccountInConversionDestination,
  resetConvertAssetsSlice,
  setConvertRate,
  setConvertExpectedResult,
  setConvertExpectedSlippage,
  setMaxSlippage,
  setWrappedQiDeposit,
} = convertAssetsSlice.actions

export default convertAssetsSlice.reducer

export const setConvertRateHandle = createBackgroundAsyncThunk(
  "convertAssets/setConvertRateHandle",
  async (_, { getState, dispatch }) => {
    const { convertAssets } = getState() as RootState
    const { jsonRpcProvider } = globalThis.main.chainService
    let rate = 0n
    const convertingFromUtxoAccount =
      convertAssets?.from && isUtxoAccountTypeGuard(convertAssets?.from)
    if (convertingFromUtxoAccount) {
      rate = await jsonRpcProvider.getLatestQiToQuaiRate(
        Zone.Cyprus1,
        parseQi("1")
      )
      dispatch(setConvertRate(Number(formatQuai(rate))))
      return
    }

    rate = await jsonRpcProvider.getLatestQuaiToQiRate(
      Zone.Cyprus1,
      parseQuai("1")
    )
    dispatch(setConvertRate(Number(formatQi(rate))))
  }
)

const mockQiAddress = "0x0090000000000000000000000000000000000000"
const mockQuaiAddress = "0x0010000000000000000000000000000000000000"
export const setConvertExpectedResultHandle = createBackgroundAsyncThunk(
  "convertAssets/setConvertExpectedResultHandle",
  async (_, { getState, dispatch }) => {
    const { convertAssets } = getState() as RootState
    const { jsonRpcProvider } = globalThis.main.chainService
    const convertingFromUtxoAccount =
      convertAssets?.from && isUtxoAccountTypeGuard(convertAssets?.from)

    let expectedAmount = 0n
    let parsedAmount = 0n
    let formattedAmount = 0
    if (convertingFromUtxoAccount) {
      parsedAmount = parseQi(convertAssets?.amount)
      expectedAmount = await jsonRpcProvider.calculateConversionAmount({
        from: mockQiAddress,
        to: mockQuaiAddress,
        value: parsedAmount.toString(),
      })
      formattedAmount = Number(formatQuai(expectedAmount))
    } else {
      parsedAmount = parseQuai(convertAssets?.amount)
      expectedAmount = await jsonRpcProvider.calculateConversionAmount({
        from: mockQuaiAddress,
        to: mockQiAddress,
        value: parsedAmount.toString(),
      })
      formattedAmount = Number(formatQi(expectedAmount))
    }
    dispatch(setConvertExpectedResult(formattedAmount))
    if (!convertAssets?.rate || !convertAssets?.amount) return
    if (Number(convertAssets?.amount) === 0) return
    const calculatedAmount = convertAssets?.rate * Number(convertAssets?.amount)
    const slip = (calculatedAmount - formattedAmount) / calculatedAmount
    dispatch(setConvertExpectedSlippage(slip))
  }
)

export const convertAssetsHandle = createBackgroundAsyncThunk(
  "convertAssets/convertAssetsHandle",
  async (_, { getState, dispatch, extra: { main } }) => {
    const { convertAssets } = getState() as RootState

    const { from, to, amount = "0", maxSlippage = 100 } = convertAssets

    if (!from || !to) return

    if (!isUtxoAccountTypeGuard(to)) {
      await main.transactionService.convertQiToQuai(to.address, amount, maxSlippage)
    } else if (!isUtxoAccountTypeGuard(from)) {
      await main.transactionService.convertQuaiToQi(
        from.address,
        amount,
        maxSlippage
      )
    }
    setTimeout(() => {
      dispatch(resetConvertAssetsSlice())
    }, 2000)
  }
)

export const wrapQiHandle = createBackgroundAsyncThunk(
  "convertAssets/wrapQiHandle",
  async ({from, amount, to}: {from: UtxoAccountData, amount: string, to: string}, { extra: { main }, dispatch }) => {
    if (!isUtxoAccountTypeGuard(from)) {
      throw new Error("From account must be a UTXO account")
    }
    if (quais.isQuaiAddress(to)) {
      await main.transactionService.wrapQi(amount, to)
      dispatch(resetConvertAssetsSlice())
    } else {
      throw new Error("Qi address provided to wrapQiHandle but Quai address expected")
    }
  }
)

export const claimWrappedQiDepositHandle = createBackgroundAsyncThunk(
  "convertAssets/claimWrappedQiDepositHandle",
  async ({from}: {from: string}, { extra: { main } }) => {
    await main.transactionService.claimWrappedQiDeposit(from)
  }
)

export const getWrappedQiDepositHandle = createBackgroundAsyncThunk(
  "convertAssets/getWrappedQiDepositHandle",
  async ({from}: {from: string}, { extra: { main }, dispatch }) => {
    const deposit = await main.transactionService.getWrappedQiDeposit(from)
    dispatch(setWrappedQiDeposit(deposit))
    return deposit
  }
)
