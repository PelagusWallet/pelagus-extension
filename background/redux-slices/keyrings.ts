import { createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"

import { setNewSelectedAccount, UIState } from "./ui"
import { createBackgroundAsyncThunk } from "./utils"
import { Keyring, KeyringMetadata } from "../services/keyring/index"

type KeyringToVerify = {
  id: string
  mnemonic: string[]
} | null

export type KeyringsState = {
  keyrings: Keyring[]
  keyringMetadata: {
    [keyringId: string]: KeyringMetadata
  }
  importing: false | "pending" | "done"
  status: "locked" | "unlocked" | "uninitialized"
  keyringToVerify: KeyringToVerify
}

export const initialState: KeyringsState = {
  keyrings: [],
  keyringMetadata: {},
  importing: false,
  status: "uninitialized",
  keyringToVerify: null,
}

interface DeriveAddressData {
  signerId: string
  shard: string
}

export type Events = {
  createPassword: string
  lockKeyrings: never
  generateNewKeyring: string | undefined
  deriveAddress: DeriveAddressData
  importKeyring: ImportKeyring
  exportPrivKey: string
}

export const emitter = new Emittery<Events>()

interface ImportKeyring {
  mnemonic: string
  source: "internal" | "import"
  path?: string
}

// Async thunk to bubble the importKeyring action from  store to emitter.
export const importKeyring = createBackgroundAsyncThunk(
  "keyrings/importKeyring",
  async ({ mnemonic, source, path }: ImportKeyring, { getState, dispatch }) => {
    await emitter.emit("importKeyring", { mnemonic, path, source })

    const { keyrings, ui } = getState() as {
      keyrings: KeyringsState
      ui: UIState
    }
    // Set the selected account as the first address of the last added keyring,
    // which will correspond to the last imported keyring, AKA this one. Note that
    // this does rely on the KeyringService's behavior of pushing new keyrings to
    // the end of the keyring list.
    dispatch(
      setNewSelectedAccount({
        address: keyrings.keyrings.slice(-1)[0].addresses[0],
        network: ui.selectedAccount.network,
      })
    )
  }
)

const keyringsSlice = createSlice({
  name: "keyrings",
  initialState,
  reducers: {
    keyringLocked: (state) => ({ ...state, status: "locked" }),
    keyringUnlocked: (state) => ({ ...state, status: "unlocked" }),
    updateKeyrings: (
      state,
      {
        payload: { keyrings, keyringMetadata },
      }: {
        payload: {
          keyrings: Keyring[]
          keyringMetadata: { [keyringId: string]: KeyringMetadata }
        }
      }
    ) => {
      // When the keyrings are locked, we receive updateKeyrings with an empty
      // list as the keyring service clears the in-memory keyrings. For UI
      // purposes, however, we want to continue tracking the keyring metadata,
      // so we ignore an empty list if the keyrings are locked.
      if (keyrings.length === 0 && state.status === "locked") {
        return state
      }

      return {
        ...state,
        keyrings,
        keyringMetadata,
      }
    },
    setKeyringToVerify: (state, { payload }: { payload: KeyringToVerify }) => ({
      ...state,
      keyringToVerify: payload,
    }),
  },
  extraReducers: (builder) => {
    builder
      .addCase(importKeyring.pending, (state) => {
        return {
          ...state,
          importing: "pending",
        }
      })
      .addCase(importKeyring.fulfilled, (state) => {
        return {
          ...state,
          importing: "done",
          keyringToVerify: null,
        }
      })
  },
})

export const {
  updateKeyrings,
  keyringLocked,
  keyringUnlocked,
  setKeyringToVerify,
} = keyringsSlice.actions

export default keyringsSlice.reducer

// Async thunk to bubble the generateNewKeyring action from  store to emitter.
export const generateNewKeyring = createBackgroundAsyncThunk(
  "keyrings/generateNewKeyring",
  async (path?: string) => {
    await emitter.emit("generateNewKeyring", path)
  }
)

export const deriveAddress = createBackgroundAsyncThunk(
  "keyrings/deriveAddress",
  async ({signerId: id, shard: shard}: DeriveAddressData) => {
    if(id == "") {
      console.log("No signerId provided, skipping derive address")
      return
    }
    console.log("Emitting derive address for signerId: " + id + " and shard: " + shard)
    await emitter.emit("deriveAddress", {signerId: id, shard: shard})
  }
)

export const unlockKeyrings = createBackgroundAsyncThunk(
  "keyrings/unlockKeyrings",
  async (password: string, { extra: { main } }) => {
    return { success: await main.unlockKeyrings(password) }
  }
)

export const lockKeyrings = createBackgroundAsyncThunk(
  "keyrings/lockKeyrings",
  async () => {
    await emitter.emit("lockKeyrings")
  }
)

export const createPassword = createBackgroundAsyncThunk(
  "keyrings/createPassword",
  async (password: string) => {
    await emitter.emit("createPassword", password)
  }
)

export const exportPrivKey = createBackgroundAsyncThunk(
  "keyrings/exportPrivKey",
  async (address: string) => {
    return { key: await main.exportPrivKey(address) }
  }
)
