import ChainService from ".."

jest.mock("../../notifications", () => ({
  __esModule: true,
  default: class NotificationsManager {},
}))

type ChainServiceTestConstructor = new (
  db: unknown,
  providerFactoryService: unknown,
  preferenceService: unknown,
  keyringService: unknown
) => ChainService

describe("Qi wallet sync", () => {
  it("does not access wallet state or the database while locked", async () => {
    const db = {
      getQiLastFullScan: jest.fn(),
      getQiLastSync: jest.fn(),
      clearQiOutpoints: jest.fn(),
      clearQiWalletSyncInfo: jest.fn(),
    }
    const keyringService = {
      isLocked: jest.fn(() => true),
      getQiHDWallet: jest.fn(),
    }
    const TestChainService =
      ChainService as unknown as ChainServiceTestConstructor
    const service = new TestChainService(db, {}, {}, keyringService)

    await service.syncQiWallet({ forceFullScan: true })

    expect(keyringService.getQiHDWallet).not.toHaveBeenCalled()
    expect(db.getQiLastFullScan).not.toHaveBeenCalled()
    expect(db.clearQiOutpoints).not.toHaveBeenCalled()
  })
})
