import { QiHDWallet } from "quais"
import KeyringService from ".."
import WalletManager from "../wallet-manager"

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
})
