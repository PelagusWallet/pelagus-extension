import { QiHDWallet } from "quais"
import KeyringService from ".."
import WalletManager from "../wallet-manager"
import { KEYRING_LOCKED_ERROR } from "../errors"
import { SignerImportSource, SignerSourceTypes } from "../types"

jest.mock("../../../index", () => ({
  browser: {},
}))

describe("KeyringService lock guards", () => {
  let keyringService: KeyringService

  beforeEach(async () => {
    keyringService = await KeyringService.create()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("does not count background Qi wallet reads as user activity", async () => {
    const wallet = {} as QiHDWallet
    jest.spyOn(keyringService, "isLocked").mockReturnValue(false)
    jest
      .spyOn(WalletManager.prototype, "getQiHDWallet")
      .mockResolvedValue(wallet)
    keyringService.lastInternalWalletActivity = 1000
    keyringService.lastExternalWalletActivity = 2000

    await expect(keyringService.getQiHDWallet()).resolves.toBe(wallet)

    expect(keyringService.lastInternalWalletActivity).toBe(1000)
    expect(keyringService.lastExternalWalletActivity).toBe(2000)
  })

  it("blocks access to the Qi wallet while locked", async () => {
    await expect(keyringService.getQiHDWallet()).rejects.toThrow(
      "KeyringService must be unlocked"
    )
  })

  it("blocks keyring removal while locked", async () => {
    await expect(
      keyringService.removeKeyring(
        "0x0000000000000000000000000000000000000000",
        "keyring"
      )
    ).rejects.toThrow("KeyringService must be unlocked")
  })

  // Regression: a locked vault (e.g. the service worker restarted during
  // onboarding) used to throw out of importKeyring, leaving the UI with an
  // unexplained failure and no way to recover.
  it("reports a locked vault as a recoverable import error", async () => {
    const importSigner = jest.spyOn(WalletManager.prototype, "importSigner")

    await expect(
      keyringService.importKeyring({
        type: SignerSourceTypes.keyring,
        mnemonic: "test",
        source: SignerImportSource.internal,
        path: "m/44'/1'/0'/0",
      })
    ).resolves.toEqual({ address: null, errorMessage: KEYRING_LOCKED_ERROR })

    expect(importSigner).not.toHaveBeenCalled()
  })
})
