import { AccountBalance } from "../../../accounts"
import { NetworkInterface } from "../../../constants/networks/networkTypes"
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
  default: {},
}))

type ChainServiceTestConstructor = new (...args: unknown[]) => ChainService

const address = "0x0010000000000000000000000000000000000000"
const asset = {
  name: "Quai",
  symbol: "QUAI",
  decimals: 18,
}
const network = {
  chainID: "9",
  baseAsset: asset,
} as NetworkInterface

const makeBalance = (retrievedAt: number): AccountBalance =>
  ({
    address,
    network,
    assetAmount: { asset, amount: 10n },
    lockedAmount: { asset, amount: 2n },
    dataSource: "local",
    retrievedAt,
  } as AccountBalance)

describe("Quai base balance refresh", () => {
  beforeEach(() => {
    globalThis.main = {
      SelectedShard: "0x00",
      SetShard: jest.fn(),
      SetNetworkError: jest.fn().mockResolvedValue(undefined),
    } as unknown as typeof globalThis.main
  })

  it("reuses a balance retrieved less than one minute ago", async () => {
    const cachedBalance = makeBalance(Date.now() - 30_000)
    const db = {
      getBaseAssetForNetwork: jest.fn().mockResolvedValue(asset),
      getLatestAccountBalance: jest.fn().mockResolvedValue(cachedBalance),
      getAccountsToTrack: jest.fn().mockResolvedValue([{ address, network }]),
      addBalance: jest.fn(),
    }
    const provider = {
      getBalance: jest.fn(),
      getLockedBalance: jest.fn(),
    }
    const TestChainService =
      ChainService as unknown as ChainServiceTestConstructor
    const service = new TestChainService(db, {}, {}, {})
    service.jsonRpcProvider = provider as never

    await expect(
      service.getLatestBaseAccountBalance({ address, network })
    ).resolves.toBe(cachedBalance)

    expect(provider.getBalance).not.toHaveBeenCalled()
    expect(provider.getLockedBalance).not.toHaveBeenCalled()
  })

  it("coalesces a forced access refresh with another balance request", async () => {
    let resolveBalance: (balance: bigint) => void = () => undefined
    const balancePromise = new Promise<bigint>((resolve) => {
      resolveBalance = resolve
    })
    const db = {
      getBaseAssetForNetwork: jest.fn().mockResolvedValue(asset),
      getLatestAccountBalance: jest.fn().mockResolvedValue(null),
      getAccountsToTrack: jest.fn().mockResolvedValue([{ address, network }]),
      addBalance: jest.fn().mockResolvedValue(undefined),
    }
    const provider = {
      getBalance: jest.fn().mockReturnValue(balancePromise),
      getLockedBalance: jest.fn().mockResolvedValue(2n),
    }
    const TestChainService =
      ChainService as unknown as ChainServiceTestConstructor
    const service = new TestChainService(db, {}, {}, {})
    service.jsonRpcProvider = provider as never

    const accessRefresh = service.getLatestBaseAccountBalance(
      { address, network },
      { force: true }
    )
    const terminalRefresh = service.getLatestBaseAccountBalance({
      address,
      network,
    })
    resolveBalance(10n)

    await Promise.all([accessRefresh, terminalRefresh])

    expect(provider.getBalance).toHaveBeenCalledTimes(1)
    expect(provider.getLockedBalance).toHaveBeenCalledTimes(1)
    expect(db.addBalance).toHaveBeenCalledTimes(1)
  })

  it("forces the terminal fallback when no matching access event was seen", async () => {
    const cachedBalance = makeBalance(Date.now() - 30_000)
    const db = {
      getBaseAssetForNetwork: jest.fn().mockResolvedValue(asset),
      getLatestAccountBalance: jest.fn().mockResolvedValue(cachedBalance),
      getAccountsToTrack: jest.fn().mockResolvedValue([{ address, network }]),
      addBalance: jest.fn().mockResolvedValue(undefined),
    }
    const provider = {
      getBalance: jest.fn().mockResolvedValue(11n),
      getLockedBalance: jest.fn().mockResolvedValue(3n),
    }
    const TestChainService =
      ChainService as unknown as ChainServiceTestConstructor
    const service = new TestChainService(db, {}, {}, {})
    service.jsonRpcProvider = provider as never

    await service.refreshBaseAccountBalanceAfterTransaction(
      { address, network },
      `0x00${"01".repeat(31)}`
    )

    expect(provider.getBalance).toHaveBeenCalledTimes(1)
    expect(provider.getLockedBalance).toHaveBeenCalledTimes(1)
  })

  it("reuses the access refresh when the matching block was seen", async () => {
    const blockHash = `0x00${"01".repeat(31)}`
    const cachedBalance = makeBalance(Date.now() - 1_000)
    const db = {
      getBaseAssetForNetwork: jest.fn().mockResolvedValue(asset),
      getLatestAccountBalance: jest.fn().mockResolvedValue(cachedBalance),
      getAccountsToTrack: jest.fn().mockResolvedValue([{ address, network }]),
      addBalance: jest.fn(),
    }
    const provider = {
      getBalance: jest.fn(),
      getLockedBalance: jest.fn(),
    }
    const TestChainService =
      ChainService as unknown as ChainServiceTestConstructor
    const service = new TestChainService(db, {}, {}, {})
    service.jsonRpcProvider = provider as never
    const externalizedService = service as unknown as {
      processedAddressAccesses: Map<string, ReturnType<typeof setTimeout>>
    }
    const cleanupTimer = setTimeout(() => undefined, 60_000)
    externalizedService.processedAddressAccesses.set(
      `${network.chainID}:${blockHash.toLowerCase()}:${address.toLowerCase()}`,
      cleanupTimer
    )

    await service.refreshBaseAccountBalanceAfterTransaction(
      { address, network },
      blockHash
    )

    expect(provider.getBalance).not.toHaveBeenCalled()
    expect(provider.getLockedBalance).not.toHaveBeenCalled()
    clearTimeout(cleanupTimer)
  })
})
