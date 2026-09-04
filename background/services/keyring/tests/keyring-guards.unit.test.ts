import KeyringService from ".."

jest.mock("../../../index", () => ({
  browser: {},
}))

describe("KeyringService lock guards", () => {
  let keyringService: KeyringService

  beforeEach(async () => {
    keyringService = await KeyringService.create()
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
