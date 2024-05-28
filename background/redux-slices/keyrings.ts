import { createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import { setNewSelectedAccount, UIState } from "./ui"
import { createBackgroundAsyncThunk } from "./utils"
import {
  Keyring,
  PrivateKey,
  SignerImportMetadata,
  SignerImportSource,
} from "../services/keyring/index"
import OnboardingRoutes from "@pelagus/pelagus-ui/pages/Onboarding/Tabbed/Routes"

type KeyringToVerify = {
  id: string
  mnemonic: string[]
} | null

export type KeyringsState = {
  keyrings: Keyring[]
  privateKeys: PrivateKey[]
  keyringMetadata: {
    [keyringId: string]: { source: SignerImportSource }
  }
  status: "locked" | "unlocked" | "uninitialized"
  keyringToVerify: KeyringToVerify
  // FIXME temp fix
  nextPage: string
}

export const initialState: KeyringsState = {
  keyrings: [],
  privateKeys: [],
  keyringMetadata: {},
  status: "uninitialized",
  keyringToVerify: null,
  // FIXME temp fix
  nextPage: OnboardingRoutes.IMPORT_SEED,
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
}

export const emitter = new Emittery<Events>()

// Async thunk to bubble the importKeyring action from  store to emitter.
export const importKeyring = createBackgroundAsyncThunk(
  "keyrings/importKeyring",
  async (
    signerRaw: SignerImportMetadata,
    { getState, dispatch, extra: { main } }
  ): Promise<{ success: boolean; errorMessage?: string }> => {
    const address = await main.importSigner(signerRaw)

    if (!address)
      return {
        success: false,
        errorMessage: "Unexpected error during signer import",
      }

    const { ui } = getState() as {
      ui: UIState
    }

    dispatch(
      setNewSelectedAccount({
        address,
        network: ui.selectedAccount.network,
      })
    )

    return { success: true }
  }
)

const keyringsSlice = createSlice({
  name: "keyrings",
  initialState,
  reducers: {
    keyringLocked: (state) => ({ ...state, status: "locked" }),
    keyringUnlocked: (state) => ({ ...state, status: "unlocked" }),
    // FIXME temp fix
    keyringNextPage: (state, { payload }) => ({
      ...state,
      nextPage: payload,
    }),
    updateKeyrings: (
      state,
      {
        payload: { privateKeys, keyrings, keyringMetadata },
      }: {
        payload: {
          privateKeys: PrivateKey[]
          keyrings: Keyring[]
          keyringMetadata: {
            [keyringId: string]: { source: SignerImportSource }
          }
        }
      }
    ) => {
      // When the keyrings are locked, we receive updateKeyrings with an empty
      // list as the keyring service clears the in-memory keyrings. For UI
      // purposes, however, we want to continue tracking the keyring metadata,
      // so we ignore an empty list if the keyrings are locked.
      if (keyrings.length === 0 && state.status === "locked") return state

      return {
        ...state,
        keyrings,
        privateKeys,
        keyringMetadata,
      }
    },
    setKeyringToVerify: (state, { payload }: { payload: KeyringToVerify }) => ({
      ...state,
      keyringToVerify: payload,
    }),
  },
})

export const {
  updateKeyrings,
  keyringLocked,
  // FIXME temp fix
  keyringNextPage,
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
  async ({ signerId: id, shard }: DeriveAddressData) => {
    if (id == "") return

    await emitter.emit("deriveAddress", { signerId: id, shard })
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
