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
import { getExtendedZoneForAddress } from "../services/chain/utils"
import {
  EnrichedQuaiTransaction,
  QuaiTransactionState,
} from "../services/chain/types"

export { Activity, ActivityDetail, INFINITE_VALUE }
export type Activities = {
  [address: string]: {
    [chainID: string]: Activity[]
  }
}

type ActivitiesState = {
  activities: Activities
}

const initialState: ActivitiesState = {
  activities: {},
}

const ACTIVITIES_MAX_COUNT = 25

const cleanActivitiesArray = (activitiesArray: Activity[] = []) => {
  activitiesArray.sort(sortActivities)
  activitiesArray.splice(ACTIVITIES_MAX_COUNT)
}

const addActivityToState =
  (activities: Activities) =>
  (
    address: string,
    chainID: string,
    transaction: QuaiTransactionState | EnrichedQuaiTransaction
  ) => {
    const isEtx =
      transaction.to &&
      transaction.from &&
      getExtendedZoneForAddress(transaction.from, false) !==
        getExtendedZoneForAddress(transaction.to, false)
    // Don't add TX if it's an ETX, and it's not from the null address, this will lead to duplicate transactions
    // Example: 0xCyprus1 -> 0xCyprus2 (TX1) generates an ITX on Cyprus2 which is 0x00000 -> 0xCyprus2 (TX2)
    // 0xCyprus1 Activities: TX1
    // 0xCyprus2 Activities: TX1, TX2
    if (
      isEtx &&
      sameQuaiAddress(transaction.to, address) &&
      !sameQuaiAddress(
        transaction.from,
        "0x0000000000000000000000000000000000000000"
      )
    ) {
      return
    }

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
  transactions: QuaiTransactionState[]
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
        chainId === activeNetwork.chainID && sameQuaiAddress(to, address)
    )
    const isTrackedFrom = accounts.some(
      ({ address, network: activeNetwork }) =>
        chainId === activeNetwork.chainID && sameQuaiAddress(from, address)
    )

    if (
      to &&
      isTrackedTo &&
      from &&
      (getExtendedZoneForAddress(to, false) ===
        getExtendedZoneForAddress(from, false) ||
        sameQuaiAddress(from, "0x0000000000000000000000000000000000000000"))
    ) {
      addActivity(to, String(chainId), transaction)
    }
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
          transactions: QuaiTransactionState[]
          accounts: AddressOnNetwork[]
        }
      }
    ) => ({
      activities: initializeActivitiesFromTransactions(payload),
    }),
    initializeActivitiesForAccount: (
      immerState,
      {
        payload: { transactions, account },
      }: {
        payload: {
          transactions: QuaiTransactionState[]
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
  },
})

export const {
  initializeActivities,
  addActivity,
  removeActivities,
  initializeActivitiesForAccount,
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
