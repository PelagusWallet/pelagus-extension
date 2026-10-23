import { AccountBalance, AddressOnNetwork } from "../../../accounts"
import { QuaiMainnet as network } from "../../../constants/networks/networks"
import WalletManager from "../../keyring/wallet-manager"
import { IVaultManager } from "../../keyring/vault-manager"
import { KeyringTypes } from "../../keyring/types"
import ChainService from ".."

jest.mock("webextension-polyfill", () => ({
  __esModule: true,
  default: {
    alarms: {
      clear: jest.fn(),
      create: jest.fn(),
      onAlarm: { addListener: jest.fn(), removeListener: jest.fn() },
    },
  },
}))
jest.mock("../../notifications", () => ({
  __esModule: true,
  default: { createIncomingAssetsNotification: jest.fn() },
}))

type TestChainServiceConstructor = new (...args: unknown[]) => ChainService
interface ChainServiceInternals {
  handleQuaiAddressAccess: (
    network: AddressOnNetwork["network"],
    address: string,
    blockHash: string
  ) => Promise<void>
  loadHistoricAssetTransfers: (account: AddressOnNetwork) => Promise<void>
}
const address = "0x0010000000000000000000000000000000000000"
const account = { address, network }
const blockA = `0x00${"01".repeat(31)}`
const blockB = `0x00${"02".repeat(31)}`
const asset = network.baseAsset

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function createService() {
  let cached: AccountBalance | null = {
    ...account,
    assetAmount: { asset, amount: 10n },
    lockedAmount: { asset, amount: 2n },
    dataSource: "local",
    retrievedAt: Date.now() - 30_000,
  }
  const tracked: AddressOnNetwork[] = [account]
  const db = {
    getBaseAssetForNetwork: jest.fn(async () => asset),
    getLatestAccountBalance: jest.fn(async () => cached),
    getAccountsToTrack: jest.fn(async () => tracked),
    getTrackedAddressesOnNetwork: jest.fn(async () => tracked),
    getTrackedAccountOnNetwork: jest.fn(async () => null),
    addAccountToTrack: jest.fn(async (value: AddressOnNetwork) => {
      tracked.push(value)
    }),
    addBalance: jest.fn(async (value: AccountBalance) => {
      cached = value
    }),
  }
  const provider = {
    getBalance: jest.fn(async () => 20n),
    getLockedBalance: jest.fn(async () => 2n),
  }
  const websocket = { on: jest.fn(async () => undefined) }
  const factory = {
    getProvidersForNetwork: jest.fn(() => ({
      jsonRpcProvider: provider,
      webSocketProvider: websocket,
    })),
  }
  const preferences = { getSelectedAccount: jest.fn(async () => account) }
  const keyring = {
    isLocked: jest.fn(() => false),
    getKeyringSourceForAddress: jest.fn(),
  }
  const TestChainService =
    ChainService as unknown as TestChainServiceConstructor
  const service = new TestChainService(db, factory, preferences, keyring)
  service.selectedNetwork = network
  service.jsonRpcProvider = provider as never
  const internals = service as unknown as ChainServiceInternals
  jest
    .spyOn(internals, "loadHistoricAssetTransfers")
    .mockResolvedValue(undefined)
  const observed = jest.fn()
  service.emitter.on("accountsWithBalances", observed)
  globalThis.main = {
    SelectedShard: "original-shard",
    SetShard: jest.fn(),
    SetNetworkError: jest.fn(async () => undefined),
    store: {
      getState: () => ({
        account: {
          accountsData: {
            evm: {
              [network.chainID]: { [address]: { balances: { QUAI: cached } } },
            },
          },
        },
      }),
    },
    indexingService: { getQiCoinbaseAddresses: jest.fn(async () => []) },
  } as unknown as typeof globalThis.main
  return {
    service,
    internals,
    db,
    provider,
    websocket,
    keyring,
    preferences,
    observed,
    tracked,
    cached: () => cached,
  }
}

describe("Quai base balance refresh", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("reuses a recent balance for ordinary reads", async () => {
    const h = createService()
    await expect(h.service.getLatestBaseAccountBalance(account)).resolves.toBe(
      h.cached()
    )
    expect(h.provider.getBalance).not.toHaveBeenCalled()
  })

  it("refreshes again when a newer block arrives during an older read", async () => {
    const h = createService()
    const pending = deferred<bigint>()
    const started = deferred<void>()
    h.provider.getBalance.mockImplementationOnce(() => {
      started.resolve()
      return pending.promise
    })
    const first = h.internals.handleQuaiAddressAccess(network, address, blockA)
    await started.promise
    const second = h.internals.handleQuaiAddressAccess(network, address, blockB)
    const duplicate = h.internals.handleQuaiAddressAccess(
      network,
      address,
      blockB
    )
    pending.resolve(10n)
    await Promise.all([first, second, duplicate])
    await h.internals.handleQuaiAddressAccess(network, address, blockB)
    expect(h.provider.getBalance).toHaveBeenCalledTimes(2)
    expect(h.cached()?.assetAmount.amount).toBe(20n)
    expect(
      h.observed.mock.calls.map(
        ([event]) => event.balances[0].assetAmount.amount
      )
    ).toEqual([10n, 20n])
  })

  it("confirmation fetches fresh state even after an access event returned older HTTP state", async () => {
    const h = createService()
    h.provider.getBalance.mockResolvedValueOnce(10n)
    await h.internals.handleQuaiAddressAccess(network, address, blockA)
    const confirmed = await h.service.refreshBaseAccountBalanceAfterTransaction(
      account
    )
    expect(confirmed.assetAmount.amount).toBe(20n)
    expect(h.provider.getBalance).toHaveBeenCalledTimes(2)
  })

  it("retries a failed non-selected account and cancels retries after recovery", async () => {
    const h = createService()
    h.preferences.getSelectedAccount.mockResolvedValue({
      ...account,
      address: "0x0020000000000000000000000000000000000000",
    })
    h.provider.getBalance.mockRejectedValueOnce(new Error("timeout"))
    await expect(
      h.internals.handleQuaiAddressAccess(network, address, blockA)
    ).rejects.toThrow("timeout")

    const update = h.service.emitter.once("accountsWithBalances")
    jest.advanceTimersByTime(30_000)
    expect((await update).balances[0].address).toBe(address)
    // Let the successful read finish saving before testing the next failure.
    await h.service.getLatestBaseAccountBalance(account)
    expect(h.provider.getBalance).toHaveBeenCalledTimes(2)

    h.provider.getBalance.mockRejectedValueOnce(new Error("timeout"))
    await expect(
      h.internals.handleQuaiAddressAccess(network, address, blockA)
    ).rejects.toThrow("timeout")
    await h.internals.handleQuaiAddressAccess(network, address, blockA)
    jest.advanceTimersByTime(240_000)
    expect(h.provider.getBalance).toHaveBeenCalledTimes(4)
    expect(h.cached()?.assetAmount.amount).toBe(20n)
  })

  it("bounds retry backoff and cancels pending retries when stopped", async () => {
    const h = createService()
    h.provider.getBalance.mockRejectedValue(new Error("timeout"))
    const reads = jest.spyOn(h.service, "getLatestBaseAccountBalance")
    await expect(
      h.internals.handleQuaiAddressAccess(network, address, blockA)
    ).rejects.toThrow("timeout")
    const retry = async (delay: number) => {
      jest.advanceTimersByTime(delay)
      await expect(
        reads.mock.results[reads.mock.results.length - 1].value
      ).rejects.toThrow("timeout")
    }
    await retry(30_000)
    await retry(60_000)
    await retry(120_000)
    jest.advanceTimersByTime(600_000)
    expect(h.provider.getBalance).toHaveBeenCalledTimes(4)

    await expect(
      h.internals.handleQuaiAddressAccess(network, address, blockB)
    ).rejects.toThrow("timeout")
    jest
      .spyOn(
        Object.getPrototypeOf(ChainService.prototype),
        "internalStopService"
      )
      .mockResolvedValue(undefined)
    await h.service.internalStopService()
    jest.advanceTimersByTime(600_000)
    expect(h.provider.getBalance).toHaveBeenCalledTimes(5)
  })

  it.each(["getBalance", "getLockedBalance"] as const)(
    "preserves the last good balance when %s fails and allows a fresh retry",
    async (method) => {
      const h = createService()
      const previous = h.cached()
      const transientError = method === "getBalance" ? "timeout" : "rate limit"
      h.provider[method].mockRejectedValueOnce(new Error(transientError))
      await expect(
        h.service.getLatestBaseAccountBalance(account, { force: true })
      ).rejects.toThrow(transientError)
      expect(h.db.addBalance).not.toHaveBeenCalled()
      expect(h.observed).not.toHaveBeenCalled()
      expect(h.cached()).toBe(previous)
      expect(globalThis.main.SetShard).toHaveBeenLastCalledWith(
        "original-shard"
      )
      expect(globalThis.main.SetNetworkError).not.toHaveBeenCalled()
      h.provider[method].mockRejectedValueOnce(
        new Error("could not detect network")
      )
      await expect(
        h.service.getLatestBaseAccountBalance(account, { force: true })
      ).rejects.toThrow("could not detect network")
      expect(globalThis.main.SetNetworkError).toHaveBeenCalledWith({
        chainId: network.chainID,
        error: true,
      })
      await expect(
        h.service.getLatestBaseAccountBalance(account, { force: true })
      ).resolves.toMatchObject({ assetAmount: { amount: 20n } })
      expect(globalThis.main.SetNetworkError).toHaveBeenLastCalledWith({
        chainId: network.chainID,
        error: false,
      })
    }
  )

  it("retries failed subscriptions without duplicating successful subscriptions", async () => {
    const h = createService()
    h.tracked.push({
      address: "0x0020000000000000000000000000000000000000",
      network,
    })
    h.websocket.on.mockRejectedValueOnce(new Error("subscription unavailable"))
    await h.service.ensureAddressSubscriptions()
    await h.service.ensureAddressSubscriptions()
    expect(h.websocket.on).toHaveBeenCalledTimes(3)
    expect(h.websocket.on).toHaveBeenLastCalledWith(
      { type: "block", address },
      expect.any(Function)
    )
  })

  it("tracks and publishes the balance of a new account without import-source metadata", async () => {
    const h = createService()
    h.tracked.length = 0
    h.db.getLatestAccountBalance.mockResolvedValue(null)
    const manager = new WalletManager({} as IVaultManager)
    manager.quaiHDWallets = [
      {
        id: "existing-wallet-id",
        type: KeyringTypes.mnemonicBIP39S256,
        addresses: [address],
        path: null,
      },
    ]
    h.keyring.getKeyringSourceForAddress.mockImplementation((value: string) =>
      manager.getSignerSource(value)
    )
    const update = h.service.emitter.once("accountsWithBalances")
    const newAccount = h.service.emitter.once("newAccountToTrack")
    await h.service.addAccountToTrack(account)
    expect(await newAccount).toMatchObject({
      addressOnNetwork: account,
      source: null,
    })
    expect((await update).balances[0].assetAmount.amount).toBe(20n)
    expect(h.db.addAccountToTrack).toHaveBeenCalledWith(account)
    expect(h.websocket.on).toHaveBeenCalledWith(
      { type: "block", address },
      expect.any(Function)
    )
    expect(manager.keyringMetadata).toEqual({})
  })
})
