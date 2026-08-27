import { IDBFactory } from "fake-indexeddb"
import { ChainDatabase, initializeChainDatabase, QiOutpoint } from "../db"

describe("Qi outpoint database", () => {
  let db: ChainDatabase
  const qiOutpoint: QiOutpoint = {
    outpoint: {
      txhash: "ABCDEF",
      index: 2,
      denomination: 7,
      lock: 0,
    },
    value: 5000n,
    address: "0x00FB2BaB5Aa8380F94b88fdE88e306606A4bFA51",
    chainID: "1337",
    derivationPath: "BIP44:change",
  }

  beforeEach(() => {
    indexedDB = new IDBFactory()
    db = initializeChainDatabase({ indexedDB })
  })

  afterEach(() => db.close())

  it("normalizes transaction hashes when storing outpoints", async () => {
    await db.addQiOutpoints([qiOutpoint])

    const stored = await db.table("qiOutpoints").toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0].outpoint.txhash).toBe("0xabcdef")
  })

  it("removes outpoints idempotently across transaction hash formats", async () => {
    await db.addQiOutpoints([qiOutpoint])

    await db.removeQiOutpoints([
      {
        ...qiOutpoint,
        outpoint: { ...qiOutpoint.outpoint, txhash: "0xABCDEF" },
      },
    ])
    await db.removeQiOutpoints([qiOutpoint])

    expect(await db.table("qiOutpoints").count()).toBe(0)
  })
})
