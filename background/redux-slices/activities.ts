// Disable parameter reassign rule to be able to modify the activities object freely
// that way we can avoid nested object iteration and we can initialize object fields
/* eslint-disable no-param-reassign */

import { createSlice } from "@reduxjs/toolkit"
import { AddressOnNetwork } from "../accounts"
import {
  normalizeAddressOnNetwork,
  normalizeEVMAddress,
  sameEVMAddress,
} from "../lib/utils"
import { Transaction } from "../services/chain/db"
import { EnrichedEVMTransaction } from "../services/enrichment"
import { HexString } from "../types"
import { createBackgroundAsyncThunk } from "./utils"
import {
  sortActivities,
  getActivity,
  Activity,
  ActivityDetail,
  INFINITE_VALUE,
} from "./utils/activities-utils"
import { getShardFromAddress } from "../constants"

export { Activity, ActivityDetail, INFINITE_VALUE }
export type Activities = {
  [address: string]: {
    [chainID: string]: Activity[]
  }
}

type ActivitiesState = {
  activities: Activities
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
    transaction: Transaction | EnrichedEVMTransaction
  ) => {
    const isEtx =
      transaction.to &&
      getShardFromAddress(transaction.from) !==
        getShardFromAddress(transaction.to)
    // Don't add TX if it's an ETX and it's not from the null address, this will lead to duplicate transactions
    // Example: 0xCyprus1 -> 0xCyprus2 (TX1) generates an ITX on Cyprus2 which is 0x00000 -> 0xCyprus2 (TX2)
    // 0xCyprus1 Activities: TX1
    // 0xCyprus2 Activities: TX1, TX2
    if (
      isEtx &&
      sameEVMAddress(transaction.to, address) &&
      !sameEVMAddress(
        transaction.from,
        "0x0000000000000000000000000000000000000000"
      )
    ) {
      return
    }

    const activity = getActivity(transaction)
    const normalizedAddress = normalizeEVMAddress(address)

    activities[normalizedAddress] ??= {}
    activities[normalizedAddress][chainID] ??= []

    const exisistingIndex = activities[normalizedAddress][chainID].findIndex(
      (tx) => tx.hash === transaction.hash
    )

    if (exisistingIndex !== -1) {
      activities[normalizedAddress][chainID][exisistingIndex] = activity
    } else {
      activities[normalizedAddress][chainID].push(activity)
    }
  }

const initializeActivitiesFromTransactions = ({
  transactions,
  accounts,
}: {
  transactions: Transaction[]
  accounts: AddressOnNetwork[]
}): Activities => {
  const activities: {
    [address: string]: {
      [chainID: string]: Activity[]
    }
  } = {}

  const addActivity = addActivityToState(activities)

  const normalizedAccounts = accounts.map((account) =>
    normalizeAddressOnNetwork(account)
  )

  // Add transactions
  transactions.forEach((transaction) => {
    const { to, from, network } = transaction
    const isTrackedTo = normalizedAccounts.some(
      ({ address, network: activeNetwork }) =>
        network.chainID === activeNetwork.chainID && sameEVMAddress(to, address)
    )
    const isTrackedFrom = normalizedAccounts.some(
      ({ address, network: activeNetwork }) =>
        network.chainID === activeNetwork.chainID &&
        sameEVMAddress(from, address)
    )

    if (
      to &&
      isTrackedTo &&
      (getShardFromAddress(to) === getShardFromAddress(from) ||
        sameEVMAddress(from, "0x0000000000000000000000000000000000000000"))
    ) {
      addActivity(to, network.chainID, transaction)
    }
    if (from && isTrackedFrom) {
      addActivity(from, network.chainID, transaction)
    }
  })

  // Sort and reduce # of transactions
  normalizedAccounts.forEach(({ address, network }) =>
    cleanActivitiesArray(activities[address]?.[network.chainID])
  )

  return activities
}

const initialState: ActivitiesState = {
  activities: {},
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
        payload: { transactions: Transaction[]; accounts: AddressOnNetwork[] }
      }
    ) => ({
      activities: initializeActivitiesFromTransactions(payload),
    }),
    initializeActivitiesForAccount: (
      immerState,
      {
        payload: { transactions, account },
      }: { payload: { transactions: Transaction[]; account: AddressOnNetwork } }
    ) => {
      const {
        address,
        network: { chainID },
      } = account
      transactions.forEach((transaction) =>
        addActivityToState(immerState.activities)(address, chainID, transaction)
      )
      cleanActivitiesArray(
        immerState.activities[normalizeEVMAddress(address)]?.[chainID]
      )
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
          transaction: EnrichedEVMTransaction
          forAccounts: string[]
        }
      }
    ) => {
      const { chainID } = transaction.network
      forAccounts.forEach((address) => {
        addActivityToState(immerState.activities)(address, chainID, transaction)
        cleanActivitiesArray(
          immerState.activities[normalizeEVMAddress(address)]?.[chainID]
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

export const removeAccountActivities = createBackgroundAsyncThunk(
  "activities/removeAccountActivities",
  async (payload: HexString, { extra: { main } }) => {
    const address = payload
    const normalizedAddress = normalizeEVMAddress(address)
    await main.removeAccountActivity(normalizedAddress)
  }
)

export default activitiesSlice.reducer

export const fetchSelectedActivityDetails = createBackgroundAsyncThunk(
  "activities/fetchSelectedActivityDetails",
  async (activityHash: string, { extra: { main } }) => {
    return main.getActivityDetails(activityHash)
  }
)
