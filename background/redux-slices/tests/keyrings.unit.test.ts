import { configureStore } from "@reduxjs/toolkit"
import reducer, {
  initialState,
  keyringLocked,
  setKeyringToVerify,
} from "../keyrings"
import { allAliases } from "../utils"

describe("keyring verification state", () => {
  it("drops the plaintext seed on lock while retaining the resume flag", () => {
    const withSeed = reducer(
      initialState,
      setKeyringToVerify({ id: "0", mnemonic: ["test"] })
    )
    const locked = reducer(withSeed, keyringLocked())

    expect(locked.keyringToVerify).toBeNull()
    expect(locked.hasUnverifiedSeed).toBe(true)
  })

  it("drops the verification copy as soon as signer import succeeds", async () => {
    const main = {
      importSigner: jest.fn().mockResolvedValue({
        address: "0x208e94d5661a73360d9387d3ca169e5c130090cd",
        errorMessage: "",
      }),
    }
    const store = configureStore({
      reducer: {
        keyrings: reducer,
        ui: (state = { selectedAccount: { network: { chainID: "9" } } }) =>
          state,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ thunk: { extraArgument: { main } } }),
    })
    store.dispatch(setKeyringToVerify({ id: "0", mnemonic: ["test"] }))

    // The background alias runs the real async import action.
    const importAction = allAliases["keyrings/importKeyring"]({
      type: "keyrings/importKeyring",
      payload: {},
    })
    const result = await store.dispatch(importAction)

    expect(result.payload).toMatchObject({ success: true })
    expect(main.importSigner).toHaveBeenCalledTimes(1)
    expect(store.getState().keyrings.keyringToVerify).toBeNull()
    expect(store.getState().keyrings.hasUnverifiedSeed).toBe(false)
  })
})
