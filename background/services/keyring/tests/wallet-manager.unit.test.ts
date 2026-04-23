import { Mnemonic, QiHDWallet, QuaiHDWallet } from "quais"
import WalletManager from "../wallet-manager"
import { IVaultManager } from "../vault-manager"
import {
  SerializedVaultData,
  SignerImportSource,
} from "../types"

jest.mock("webextension-polyfill", () => ({
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
}))

const phrase = "test test test test test test test test test test test junk"

function fixedQuaiXPub(this: QuaiHDWallet): string {
  return (this as unknown as { _root: { neuter: () => { extendedKey: string } } })
    ._root.neuter().extendedKey
}

function fixedQiXPub(this: QiHDWallet): string {
  return (this as unknown as { _root: { neuter: () => { extendedKey: string } } })
    ._root.neuter().extendedKey
}

function legacyId(wallet: QiHDWallet | QuaiHDWallet): string {
  return (wallet as unknown as { _root: { extendedKey: string } })._root
    .extendedKey
}

describe("WalletManager", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("migrates legacy HD wallet metadata keys from xprv IDs to xpub IDs", async () => {
    jest.spyOn(QuaiHDWallet.prototype, "xPub").mockImplementation(fixedQuaiXPub)
    jest.spyOn(QiHDWallet.prototype, "xPub").mockImplementation(fixedQiXPub)

    const mnemonic = Mnemonic.fromPhrase(phrase)
    const quaiWallet = QuaiHDWallet.fromMnemonic(mnemonic)
    const qiWallet = QiHDWallet.fromMnemonic(mnemonic)
    const quaiXpub = quaiWallet.xPub()
    const qiXpub = qiWallet.xPub()
    const privateKeyId = "0xprivate-key-id"

    let vaultData: SerializedVaultData = {
      wallets: [],
      qiHDWallet: qiWallet.serialize(),
      quaiHDWallets: [quaiWallet.serialize()],
      metadata: {
        [legacyId(quaiWallet)]: { source: SignerImportSource.import },
        [legacyId(qiWallet)]: { source: SignerImportSource.internal },
        [privateKeyId]: { source: SignerImportSource.import },
      },
      hiddenAccounts: {},
    }

    const vault: IVaultManager = {
      get: jest.fn(async () => vaultData),
      add: jest.fn(async (data, options) => {
        if (options.overwriteMetadata) {
          vaultData = {
            ...vaultData,
            metadata: data.metadata ?? {},
          }
        }
      }),
      delete: jest.fn(),
      update: jest.fn(),
      verifyPassword: jest.fn(),
      clearSaltedKey: jest.fn(),
      isSaltedKeyInitialized: jest.fn(),
      initializeWithPassword: jest.fn(),
    }

    const manager = new WalletManager(vault)
    await manager.initializeState()

    expect(manager.qiHDWallet?.id).toEqual(qiXpub)
    expect(manager.quaiHDWallets[0].id).toEqual(quaiXpub)
    expect(manager.keyringMetadata).toEqual({
      [quaiXpub]: { source: SignerImportSource.import },
      [qiXpub]: { source: SignerImportSource.internal },
      [privateKeyId]: { source: SignerImportSource.import },
    })
    expect(vault.add).toHaveBeenCalledWith(
      { metadata: manager.keyringMetadata },
      { overwriteMetadata: true }
    )
    expect(Object.keys(vaultData.metadata)).not.toContain(legacyId(quaiWallet))
    expect(Object.keys(vaultData.metadata)).not.toContain(legacyId(qiWallet))
  })
})
