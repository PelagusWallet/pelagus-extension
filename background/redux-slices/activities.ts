// Disable parameter reassign rule to be able to modify the activities object freely
// that way we can avoid nested object iteration and we can initialize object fields
/* eslint-disable no-param-reassign */
import { createSlice } from "@reduxjs/toolkit"
import { AddressOnNetwork } from "../accounts"
import { sameQuaiAddress } from "../lib/utils"
import { HexString } from "../types"
import { createBackgroundAsyncThunk } from "./utils"
import {
  sortActivities,
  getActivity,
  Activity,
  ActivityDetail,
  INFINITE_VALUE,
} from "./utils/activities-utils"
import {
  EnrichedQuaiTransaction,
  QiTransactionDB,
  QuaiTransactionDB,
} from "../services/transactions/types"
import { initializeUtxoActivitiesFromTransactions } from "./utils/utxo-activities-utils"

export { Activity, ActivityDetail, INFINITE_VALUE }
export type Activities = {
  [address: string]: {
    [chainID: string]: Activity[]
  }
}

export type UtxoActivities = {
  [paymentCode: string]: {
    [chainID: string]: QiTransactionDB[]
  }
}

type ActivitiesState = {
  activities: Activities
  utxoActivities: UtxoActivities
}

const initialState: ActivitiesState = {
  activities: {},
  utxoActivities: {},
}

export const ACTIVITIES_MAX_COUNT = 25

const cleanActivitiesArray = (activitiesArray: Activity[] = []) => {
  activitiesArray.sort(sortActivities)
  activitiesArray.splice(ACTIVITIES_MAX_COUNT)
}

const addActivityToState =
  (activities: Activities) =>
  (
    address: string,
    chainID: string,
    transaction: QuaiTransactionDB | EnrichedQuaiTransaction
  ) => {
    // TODO temp fix
    // const isEtx =
    //   transaction.to &&
    //   transaction.from &&
    //   getExtendedZoneForAddress(transaction.from, false) !==
    //     getExtendedZoneForAddress(transaction.to, false)
    // // Don't add TX if it's an ETX, and it's not from the null address, this will lead to duplicate transactions
    // // Example: 0xCyprus1 -> 0xCyprus2 (TX1) generates an ITX on Cyprus2 which is 0x00000 -> 0xCyprus2 (TX2)
    // // 0xCyprus1 Activities: TX1
    // // 0xCyprus2 Activities: TX1, TX2
    // if (
    //   isEtx &&
    //   sameQuaiAddress(transaction.to, address) &&
    //   !sameQuaiAddress(
    //     transaction.from,
    //     "0x0000000000000000000000000000000000000000"
    //   )
    // ) {
    //   return
    // }

    const activity = getActivity(transaction)

    activities[address] ??= {}
    activities[address][chainID] ??= []

    const existingIndex = activities[address][chainID].findIndex(
      (tx) => tx.hash === transaction.hash
    )

    if (existingIndex !== -1) {
      activities[address][chainID][existingIndex] = activity
    } else {
      activities[address][chainID].push(activity)
    }
  }

const initializeActivitiesFromTransactions = ({
  transactions,
  accounts,
}: {
  transactions: QuaiTransactionDB[]
  accounts: AddressOnNetwork[]
}): Activities => {
  const activities: {
    [address: string]: {
      [chainID: string]: Activity[]
    }
  } = {}

  const addActivity = addActivityToState(activities)

  transactions.forEach((transaction) => {
    const { to, from, chainId } = transaction
    const isTrackedTo = accounts.some(
      ({ address, network: activeNetwork }) =>
        chainId.toString() === activeNetwork.chainID &&
        sameQuaiAddress(to, address)
    )
    const isTrackedFrom = accounts.some(
      ({ address, network: activeNetwork }) =>
        chainId.toString() === activeNetwork.chainID &&
        sameQuaiAddress(from, address)
    )

    // adding tx to UI for receiver(to)
    if (to && from && isTrackedTo) {
      addActivity(to, String(chainId), transaction)
    }

    // adding tx to UI for sender(from)
    if (from && isTrackedFrom) {
      addActivity(from, String(chainId), transaction)
    }
  })

  accounts.forEach(({ address, network }) =>
    cleanActivitiesArray(activities[address]?.[network.chainID])
  )

  return activities
}

const activitiesSlice = createSlice({
  name: "activities",
  initialState,
  reducers: {
    initializeActivities: (
      immerState,
      {
        payload,
      }: {
        payload: {
          transactions: QuaiTransactionDB[]
          accounts: AddressOnNetwork[]
        }
      }
    ) => {
      immerState.activities = initializeActivitiesFromTransactions(payload)
    },
    initializeActivitiesForAccount: (
      immerState,
      {
        payload: { transactions, account },
      }: {
        payload: {
          transactions: QuaiTransactionDB[]
          account: AddressOnNetwork
        }
      }
    ) => {
      const {
        address,
        network: { chainID },
      } = account
      transactions.forEach((transaction) =>
        addActivityToState(immerState.activities)(address, chainID, transaction)
      )
      cleanActivitiesArray(immerState.activities[address]?.[chainID])
    },
    removeActivities: (
      immerState,
      { payload: address }: { payload: HexString }
    ) => {
      immerState.activities[address] = {}
    },
    addActivity: (
      immerState,
      {
        payload: { transaction, forAccounts },
      }: {
        payload: {
          transaction: EnrichedQuaiTransaction
          forAccounts: string[]
        }
      }
    ) => {
      const { chainId } = transaction
      if (!chainId) throw new Error("Failed het chainId from transaction")

      forAccounts.forEach((address) => {
        addActivityToState(immerState.activities)(
          address,
          chainId.toString(),
          transaction
        )
        cleanActivitiesArray(
          immerState.activities[address]?.[chainId.toString()]
        )
      })
    },
    initializeUtxoActivities: (
      immerState,
      { payload }: { payload: QiTransactionDB[] }
    ) => {
      immerState.utxoActivities =
        initializeUtxoActivitiesFromTransactions(payload)
    },
    addUtxoActivity: (
      immerState,
      { payload }: { payload: QiTransactionDB }
    ) => {
      const { senderPaymentCode, receiverPaymentCode } = payload
      const chainId = payload.chainId.toString()

      const validateActivitiesHandle = (paymentCode: string) => {
        if (!paymentCode) return []

        if (!immerState.utxoActivities[paymentCode]) {
          immerState.utxoActivities[paymentCode] = {}
        }
        if (!immerState.utxoActivities[paymentCode][chainId]) {
          immerState.utxoActivities[paymentCode][chainId] = []
        }
        return immerState.utxoActivities[paymentCode][chainId]
      }

      const addHandle = (activities: QiTransactionDB[]) => {
        if (!activities) return
        activities.unshift(payload)
      }

      const fromActivities = validateActivitiesHandle(senderPaymentCode)
      const toActivities = validateActivitiesHandle(receiverPaymentCode)

      addHandle(fromActivities)
      addHandle(toActivities)
    },
    updateUtxoActivity: (
      immerState,
      { payload }: { payload: QiTransactionDB }
    ) => {
      const { senderPaymentCode, receiverPaymentCode, chainId, hash } = payload

      const updateHandle = (activities: QiTransactionDB[]) => {
        if (!activities || !activities?.length) return

        const activityIndex = activities.findIndex(
          (activity) => activity.hash === hash
        )

        if (activityIndex === -1) return

        activities.splice(activityIndex, 1, payload)
      }

      const fromActivities =
        immerState.utxoActivities[senderPaymentCode][chainId]
      const toActivities =
        immerState.utxoActivities[receiverPaymentCode][chainId]

      updateHandle(fromActivities)
      updateHandle(toActivities)
    },
  },
})

export const {
  initializeActivities,
  addActivity,
  removeActivities,
  initializeActivitiesForAccount,
  addUtxoActivity,
  initializeUtxoActivities,
  updateUtxoActivity,
} = activitiesSlice.actions

export default activitiesSlice.reducer

export const removeAccountActivities = createBackgroundAsyncThunk(
  "activities/removeAccountActivities",
  async (payload: HexString, { extra: { main } }) => {
    await main.removeAccountActivity(payload)
  }
)

export const fetchSelectedActivityDetails = createBackgroundAsyncThunk(
  "activities/fetchSelectedActivityDetails",
  async (activityHash: string, { extra: { main } }) => {
    return main.getActivityDetails(activityHash)
  }
)
