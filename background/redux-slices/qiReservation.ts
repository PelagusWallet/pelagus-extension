import { createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"

// Background thunks bridge the UI store to Main, which necessarily imports
// the registered reducers during startup.
// eslint-disable-next-line import/no-cycle
import { createBackgroundAsyncThunk } from "./utils"

export type QiReservationReleaseRequest = {
  requestId: string
  reservationId: string
  count: number
  zone: string
  account: number
  origin: string
  owner: string
  chainId: string
  reason: "terminal" | "accepted-fill-timeout"
}

export type QiReservationAllocationRequest = {
  requestId: string
  reservationId: string
  count: number
  zone: string
  account: number
  origin: string
  owner: string
  chainId: string
}

export type QiReservationState = {
  allocationRequest: QiReservationAllocationRequest | null
  releaseRequest: QiReservationReleaseRequest | null
  isSubmitting: boolean
  error: string | null
}

const initialState: QiReservationState = {
  allocationRequest: null,
  releaseRequest: null,
  isSubmitting: false,
  error: null,
}

type StateWithQiReservation = {
  qiReservation: QiReservationState
}

type Events = {
  confirmQiReservationAllocation: { requestId: string }
  rejectQiReservationAllocation: { requestId: string }
  confirmQiReservationRelease: { requestId: string }
  rejectQiReservationRelease: { requestId: string }
}

export const emitter = new Emittery<Events>()

const qiReservationSlice = createSlice({
  name: "qiReservation",
  initialState,
  reducers: {
    setQiReservationAllocationRequest: (
      immerState,
      { payload }: { payload: QiReservationAllocationRequest }
    ) => {
      immerState.allocationRequest = payload
      immerState.isSubmitting = false
      immerState.error = null
    },
    setQiReservationAllocationSubmitting: (
      immerState,
      { payload }: { payload: { requestId: string; isSubmitting: boolean } }
    ) => {
      if (immerState.allocationRequest?.requestId !== payload.requestId) return
      immerState.isSubmitting = payload.isSubmitting
    },
    setQiReservationAllocationError: (
      immerState,
      { payload }: { payload: { requestId: string; error: string } }
    ) => {
      if (immerState.allocationRequest?.requestId !== payload.requestId) return
      immerState.isSubmitting = false
      immerState.error = payload.error
    },
    clearQiReservationAllocationRequest: (
      immerState,
      { payload }: { payload: { requestId: string } }
    ) => {
      if (immerState.allocationRequest?.requestId !== payload.requestId) return
      immerState.allocationRequest = null
      immerState.isSubmitting = false
      immerState.error = null
    },
    setQiReservationReleaseRequest: (
      immerState,
      { payload }: { payload: QiReservationReleaseRequest }
    ) => {
      immerState.releaseRequest = payload
      immerState.isSubmitting = false
      immerState.error = null
    },
    setQiReservationReleaseSubmitting: (
      immerState,
      { payload }: { payload: { requestId: string; isSubmitting: boolean } }
    ) => {
      if (immerState.releaseRequest?.requestId !== payload.requestId) return
      immerState.isSubmitting = payload.isSubmitting
    },
    setQiReservationReleaseError: (
      immerState,
      { payload }: { payload: { requestId: string; error: string } }
    ) => {
      if (immerState.releaseRequest?.requestId !== payload.requestId) return
      immerState.isSubmitting = false
      immerState.error = payload.error
    },
    clearQiReservationReleaseRequest: (
      immerState,
      { payload }: { payload: { requestId: string } }
    ) => {
      if (immerState.releaseRequest?.requestId !== payload.requestId) return
      immerState.releaseRequest = null
      immerState.isSubmitting = false
      immerState.error = null
    },
  },
})

export const {
  setQiReservationAllocationRequest,
  setQiReservationAllocationSubmitting,
  setQiReservationAllocationError,
  clearQiReservationAllocationRequest,
  setQiReservationReleaseRequest,
  setQiReservationReleaseSubmitting,
  setQiReservationReleaseError,
  clearQiReservationReleaseRequest,
} = qiReservationSlice.actions

export default qiReservationSlice.reducer

const errorMessageFromUnknown = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return "Unable to update the reserved addresses"
}

export const confirmQiReservationAllocation = createBackgroundAsyncThunk(
  "qiReservation/confirmQiReservationAllocation",
  async ({ requestId }: { requestId: string }, { getState, dispatch }) => {
    const { qiReservation } = getState() as StateWithQiReservation
    if (qiReservation.allocationRequest?.requestId !== requestId) {
      return {
        error: { message: "This address request is no longer active" },
      }
    }

    dispatch(
      setQiReservationAllocationSubmitting({ requestId, isSubmitting: true })
    )
    try {
      await emitter.emit("confirmQiReservationAllocation", { requestId })
      return { confirmed: true }
    } catch (error: unknown) {
      const message = errorMessageFromUnknown(error)
      dispatch(setQiReservationAllocationError({ requestId, error: message }))
      return { error: { message } }
    }
  }
)

export const rejectQiReservationAllocation = createBackgroundAsyncThunk(
  "qiReservation/rejectQiReservationAllocation",
  async ({ requestId }: { requestId: string }, { getState }) => {
    const { qiReservation } = getState() as StateWithQiReservation
    if (qiReservation.allocationRequest?.requestId !== requestId) return
    await emitter.emit("rejectQiReservationAllocation", { requestId })
  }
)

export const confirmQiReservationRelease = createBackgroundAsyncThunk(
  "qiReservation/confirmQiReservationRelease",
  async ({ requestId }: { requestId: string }, { getState, dispatch }) => {
    const { qiReservation } = getState() as StateWithQiReservation
    if (qiReservation.releaseRequest?.requestId !== requestId) {
      return { error: { message: "This release request is no longer active" } }
    }

    dispatch(
      setQiReservationReleaseSubmitting({ requestId, isSubmitting: true })
    )
    try {
      await emitter.emit("confirmQiReservationRelease", { requestId })
      return { confirmed: true }
    } catch (error: unknown) {
      const message = errorMessageFromUnknown(error)
      dispatch(setQiReservationReleaseError({ requestId, error: message }))
      return { error: { message } }
    }
  }
)

export const rejectQiReservationRelease = createBackgroundAsyncThunk(
  "qiReservation/rejectQiReservationRelease",
  async ({ requestId }: { requestId: string }, { getState }) => {
    const { qiReservation } = getState() as StateWithQiReservation
    if (qiReservation.releaseRequest?.requestId !== requestId) return
    await emitter.emit("rejectQiReservationRelease", { requestId })
  }
)
