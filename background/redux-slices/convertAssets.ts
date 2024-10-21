import { createSlice } from "@reduxjs/toolkit"
import { isUtxoAccountTypeGuard } from "@pelagus/pelagus-ui/utils/accounts"
import { AccountTotal } from "./selectors"
import { createBackgroundAsyncThunk } from "./utils"
import { RootState } from "./index"
import { UtxoAccountData } from "./accounts"

export type ConvertAssetsState = {
  from: UtxoAccountData | AccountTotal | null
  to: UtxoAccountData | AccountTotal | null
  amount: string
  rate: number
}

const initialState: ConvertAssetsState = {
  from: null,
  to: null,
  amount: "",
  rate: 0,
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
    resetConvertAssetsSlice: (immerState) => {
      immerState.from = null
      immerState.to = null
      immerState.amount = ""
      immerState.rate = 0
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
} = convertAssetsSlice.actions

export default convertAssetsSlice.reducer

export const setConvertRateHandle = createBackgroundAsyncThunk(
  "convertAssets/setConvertRateHandle",
  async (_, { dispatch }) => {
    dispatch(setConvertRate(20.132))
  }
)

export const convertAssetsHandle = createBackgroundAsyncThunk(
  "convertAssets/convertAssetsHandle",
  async (_, { getState, dispatch }) => {
    const { convertAssets } = getState() as RootState
    console.log(convertAssets)

    const { from, to, amount } = convertAssets

    if (!from || !to) return

    if (isUtxoAccountTypeGuard(from)) {
      // Convert QI to QUAI
      dispatch(resetConvertAssetsSlice())
      return
    }

    // Convert QUAI to QI
    dispatch(resetConvertAssetsSlice())
  }
)
