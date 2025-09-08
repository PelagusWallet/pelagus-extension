import { createSlice } from "@reduxjs/toolkit"
import { isUtxoAccountTypeGuard, isAccountTotalTypeGuard } from "@pelagus/pelagus-ui/utils/accounts"
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
  intervalSettings: {
    enabled: boolean
    transactionCount: number
    intervalMinutes: number
  }
}

const initialState: ConvertAssetsState = {
  from: null,
  to: null,
  amount: "",
  rate: 0,
  expectedResult: 0,
  expectedSlippage: 0,
  maxSlippage: 100, // Default 1% (in basis points)
  wrappedQiDeposit: BigInt(0),
  intervalSettings: {
    enabled: false,
    transactionCount: 10,
    intervalMinutes: 1
  }
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
    setIntervalSettings: (
      immerState,
      { payload }: { payload: Partial<ConvertAssetsState['intervalSettings']> }
    ) => {
      immerState.intervalSettings = {
        ...immerState.intervalSettings,
        ...payload
      }
    },
    resetConvertAssetsSlice: (immerState) => {
      immerState.from = null
      immerState.to = null
      immerState.amount = ""
      immerState.rate = 0
      immerState.maxSlippage = 100 // Reset to default 1%
      immerState.wrappedQiDeposit = BigInt(0)
      immerState.intervalSettings = {
        enabled: false,
        transactionCount: 10,
        intervalMinutes: 1
      }
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
  setIntervalSettings,
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
      parsedAmount = parseQi(convertAssets?.amount || "0")
      expectedAmount = await jsonRpcProvider.calculateConversionAmount({
        from: mockQiAddress,
        to: mockQuaiAddress,
        value: parsedAmount.toString(),
      })
      formattedAmount = Number(formatQuai(expectedAmount))
    } else {
      parsedAmount = parseQuai(convertAssets?.amount || "0")
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

    try {
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
      return { success: true }
    } catch (error: any) {
      // Return error info that UI can handle
      return { 
        error: {
          message: error?.message || "Conversion failed",
          code: error?.code
        }
      }
    }
  }
)

export const wrapQiHandle = createBackgroundAsyncThunk(
  "convertAssets/wrapQiHandle",
  async (_, { getState }) => {
    const { convertAssets } = getState() as RootState
    const { from, amount, to } = convertAssets

    if (!from || !amount || !to || !isUtxoAccountTypeGuard(from) || !isAccountTotalTypeGuard(to)) {
      return { error: { message: "Invalid conversion parameters" } }
    }

    try {
      const txHash = await main.transactionService.wrapQi(amount, to.address)
      return { txHash }
    } catch (error: any) {
      return { 
        error: {
          message: typeof error === 'string' ? error : error?.message
        }
      }
    }
  }
)

export const unwrapQiHandle = createBackgroundAsyncThunk(
  "convertAssets/unwrapQiHandle",
  async (_, { getState }) => {
    const { convertAssets } = getState() as RootState
    const { from, amount } = convertAssets

    // For unwrapping, from is a Quai account with WQI
    // The unwrapQi function automatically finds an unused Qi address
    if (!from || !amount || !isAccountTotalTypeGuard(from)) {
      return { error: { message: "Invalid unwrap parameters" } }
    }

    try {
      const txHash = await main.transactionService.unwrapQi(amount, from.address)
      return { txHash }
    } catch (error: any) {
      return { 
        error: {
          message: typeof error === 'string' ? error : error?.message
        }
      }
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

export const startIntervalConversionHandle = createBackgroundAsyncThunk(
  "convertAssets/startIntervalConversion",
  async (_, { getState, dispatch, extra: { main } }) => {
    const { convertAssets } = getState() as RootState
    const { 
      from, 
      to, 
      amount = "0", 
      maxSlippage = 100, 
      intervalSettings 
    } = convertAssets

    if (!from || !to || !intervalSettings.enabled) {
      return { error: "Invalid interval conversion parameters" }
    }

    try {
      const intervalId = await main.transactionService.startIntervalConversion({
        from,
        to,
        amount,
        maxSlippage,
        transactionCount: intervalSettings.transactionCount,
        intervalMinutes: intervalSettings.intervalMinutes
      })

      return { intervalId }
    } catch (error: any) {
      return { error: error?.message || "Failed to start interval conversion" }
    }
  }
)

export const getIntervalConversionsHandle = createBackgroundAsyncThunk(
  "convertAssets/getIntervalConversions",
  async (_, { extra: { main } }) => {
    return await main.transactionService.getIntervalConversions()
  }
)

export const cancelIntervalConversionHandle = createBackgroundAsyncThunk(
  "convertAssets/cancelIntervalConversion",
  async (intervalId: string, { extra: { main } }) => {
    await main.transactionService.cancelIntervalConversion(intervalId)
    return intervalId
  }
)

export const getIntervalConversionHandle = createBackgroundAsyncThunk(
  "convertAssets/getIntervalConversion",
  async (intervalId: string, { extra: { main } }) => {
    return await main.transactionService.getIntervalConversion(intervalId)
  }
)
