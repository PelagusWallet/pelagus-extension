import { TransactionsDatabase } from "../db"

describe("TransactionsDatabase Qi receive reservations", () => {
  let db: TransactionsDatabase

  beforeEach(async () => {
    db = new TransactionsDatabase()
    await db.delete()
    db = new TransactionsDatabase()
    await db.open()
    expect(db.verno).toBe(5)
  })

  afterEach(async () => {
    await db.delete()
  })

  it("persists, indexes, and tombstones an expired active reservation", async () => {
    const now = Date.now()
    const reservation = {
      origin: "https://app.test",
      reservationId: "fill-1:payout",
      account: 0,
      zone: "0x00",
      count: 1,
      addresses: ["0x0080000000000000000000000000000000000001"],
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + 1000,
      status: "active" as const,
    }

    await db.putQiReceiveAddressReservation(reservation)
    await expect(
      db.getQiReceiveAddressReservation(
        reservation.origin,
        reservation.reservationId
      )
    ).resolves.toEqual(reservation)
    await expect(
      db.getUnreleasedQiReceiveAddressReservations()
    ).resolves.toEqual([reservation])
    await expect(db.getAllQiReceiveAddressReservations()).resolves.toEqual([
      reservation,
    ])

    await db.expireActiveQiReceiveAddressReservations(now + 1000)
    await expect(
      db.getQiReceiveAddressReservation(
        reservation.origin,
        reservation.reservationId
      )
    ).resolves.toEqual({
      ...reservation,
      status: "released",
      releasedAt: now + 1000,
      releaseReason: "lease-expired",
    })
    await expect(
      db.getUnreleasedQiReceiveAddressReservations()
    ).resolves.toEqual([])
    await expect(db.getAllQiReceiveAddressReservations()).resolves.toEqual([
      {
        ...reservation,
        status: "released",
        releasedAt: now + 1000,
        releaseReason: "lease-expired",
      },
    ])
  })

  it("never expires a committed reservation", async () => {
    const now = Date.now()
    const reservation = {
      origin: "https://app.test",
      reservationId: "fill-2:refund",
      account: 0,
      zone: "0x00",
      count: 1,
      addresses: ["0x0080000000000000000000000000000000000002"],
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + 1000,
      status: "committed" as const,
      committedAt: now,
    }

    await db.putQiReceiveAddressReservation(reservation)
    await db.expireActiveQiReceiveAddressReservations(now + 10_000)

    await expect(
      db.getQiReceiveAddressReservation(
        reservation.origin,
        reservation.reservationId
      )
    ).resolves.toEqual(reservation)
    await expect(
      db.getUnreleasedQiReceiveAddressReservations()
    ).resolves.toEqual([reservation])
  })
})
