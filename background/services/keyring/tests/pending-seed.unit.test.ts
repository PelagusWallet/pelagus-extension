import { webcrypto } from "crypto"
import browser from "webextension-polyfill"
import KeyringService from ".."
import WalletManager from "../wallet-manager"
import { SignerImportSource, SignerSourceTypes } from "../types"

const originalCrypto = global.crypto

describe("pending seed cleanup", () => {
  beforeEach(() => {
    Object.defineProperty(global, "crypto", {
      configurable: true,
      value: webcrypto,
    })
    const storage: Record<string, unknown> = {}
    browser.storage.local.get = jest.fn(async (key: string) =>
      key in storage ? { [key]: storage[key] } : {}
    )
    browser.storage.local.set = jest.fn(async (values) => {
      Object.assign(storage, values)
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(global, "crypto", {
      configurable: true,
      value: originalCrypto,
    })
  })

  it("removes the extra seed copy from the encrypted vault after a successful import", async () => {
    const service = await KeyringService.create()
    await expect(service.unlock("test password")).resolves.toBe(true)
    const pendingSeed = {
      id: "0",
      mnemonic: ["a", "pending", "seed"],
      verified: false,
    }
    await service.vaultManager.update({ pendingSeed })

    const internals = service as unknown as { walletManager: WalletManager }
    jest
      .spyOn(internals.walletManager, "importSigner")
      .mockResolvedValue("0x208e94d5661a73360d9387d3ca169e5c130090cd")
    await expect(
      service.importKeyring({
        type: SignerSourceTypes.keyring,
        mnemonic: pendingSeed.mnemonic.join(" "),
        source: SignerImportSource.internal,
      })
    ).resolves.toMatchObject({ errorMessage: "" })

    await expect(service.getUnverifiedSeed()).resolves.toBeNull()
    await service.lock()
    const restarted = await KeyringService.create()
    await expect(restarted.unlock("test password")).resolves.toBe(true)
    await expect(restarted.getUnverifiedSeed()).resolves.toBeNull()
    await restarted.lock()
  })
})
