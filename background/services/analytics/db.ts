import Dexie from "dexie"

import { OneTimeAnalyticsEvent } from "../../lib/posthog"

export interface AnalyticsUUID {
  uuid: string
}

export class AnalyticsDatabase extends Dexie {
  private analyticsUUID!: Dexie.Table<AnalyticsUUID, number>

  private oneTimeEvent!: Dexie.Table<{ name: string }, number>

  constructor() {
    super("pelagus/analytics")
    this.version(1)
      .stores({
        analyticsUUID: "++,uuid",
        oneTimeEvent: "++,name",
      })
      .upgrade(async (tx) => {
        await tx.table("oneTimeEvent").add({
          name: OneTimeAnalyticsEvent.ONBOARDING_STARTED,
        })
        await tx.table("oneTimeEvent").add({
          name: OneTimeAnalyticsEvent.ONBOARDING_FINISHED,
        })
      })
  }

  async getAnalyticsUUID(): Promise<string | undefined> {
    return (await this.analyticsUUID.reverse().first())?.uuid
  }

  async setAnalyticsUUID(uuid: string): Promise<void> {
    await this.analyticsUUID.add({ uuid })
  }

  async oneTimeEventExists(name: string): Promise<boolean> {
    return (await this.oneTimeEvent.where("name").equals(name).count()) > 0
  }

  async setOneTimeEvent(name: string): Promise<void> {
    await this.oneTimeEvent.add({ name })
  }
}
export async function initializeAnalyticsDatabase(): Promise<AnalyticsDatabase> {
  return new AnalyticsDatabase()
}
