import browser from "webextension-polyfill"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import BaseService from "../base"
import { AnalyticsDatabase, getOrCreateDB } from "./db"
import PreferenceService from "../preferences"
import logger from "../../lib/logger"
import { WEBSITE_ORIGIN } from "../../constants"
import {
  initializeGoogleAnalytics,
  trackEvent,
} from "./google-analytics/google-analytics"

const chainSpecificOneTimeEvents = ["CHAIN_ADDED"] as const // Adjust as needed
interface Events extends ServiceLifecycleEvents {
  enableDefaultOn: void
}

// Environment variable to control analytics destination
const ANALYTICS_DESTINATION = process.env.ANALYTICS_DESTINATION || "google" // Options: "google"

/*
 * The analytics service is responsible for listening to events in the service layer,
 * handling sending and persistence concerns.
 */
export default class AnalyticsService extends BaseService<Events> {
  /*
   * Create a new AnalyticsService. The service isn't initialized until
   * startService() is called and resolved.
   */
  static create: ServiceCreatorFunction<
    Events,
    AnalyticsService,
    [Promise<PreferenceService>]
  > = async (preferenceService) => {
    const db = await getOrCreateDB()
    return new this(db, await preferenceService)
  }

  private constructor(
    private db: AnalyticsDatabase,
    private preferenceService: PreferenceService
  ) {
    super()
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService()
    console.log("Analytics service started")

    // Initialize Google Analytics if enabled
    if (ANALYTICS_DESTINATION === "google") {
      const MEASUREMENT_ID =
        process.env.GOOGLE_ANALYTICS_PROPERTY_ID || "G-YOUR_MEASUREMENT_ID" // Replace with your actual measurement ID
      initializeGoogleAnalytics(MEASUREMENT_ID)
    }

    let { isEnabled, hasDefaultOnBeenTurnedOn } =
      await this.preferenceService.getAnalyticsPreferences()

    if (!hasDefaultOnBeenTurnedOn) {
      // this handles the edge case where we have already shipped analytics
      // but with default turned off and now we want to turn default on
      // and show a notification to the user
      isEnabled = true
      hasDefaultOnBeenTurnedOn = true

      await this.preferenceService.updateAnalyticsPreferences({
        isEnabled,
        hasDefaultOnBeenTurnedOn,
      })
    }

    if (isEnabled) {
      browser.runtime.setUninstallURL(`${WEBSITE_ORIGIN}`)
      await this.sendAnalyticsEvent("NEW_INSTALL")
    }
  }

  protected override async internalStopService(): Promise<void> {
    this.db.close()
    await super.internalStopService()
  }

  async sendAnalyticsEvent(
    eventName: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    const { isEnabled } = await this.preferenceService.getAnalyticsPreferences()
    if (eventName === "ANALYTICS_TOGGLED" || isEnabled) {
      if (ANALYTICS_DESTINATION === "google") {
        trackEvent(eventName, "extension", JSON.stringify(payload))
      }
    }
  }

  async sendOneTimeAnalyticsEvent(
    eventName: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    const { isEnabled } = await this.preferenceService.getAnalyticsPreferences()
    if (!isEnabled) return

    // There are some events that we want to send once per chainId.
    // Rather than creating a separate event for every chain - lets
    // keep the event name uniform (while sending the chainId as a payload)
    // and use the key to track if we've already sent the event for that chainId.
    const chainId = payload?.chainId
    const key = chainSpecificOneTimeEvents.includes(eventName as any)
      ? `${eventName}-${chainId}`
      : eventName

    if (await this.db.oneTimeEventExists(key)) {
      // Don't send the event if it has already been sent.
      return
    }

    if (ANALYTICS_DESTINATION === "google") {
      trackEvent(eventName, "extension", JSON.stringify(payload))
    }

    this.db.setOneTimeEvent(key)
  }

  // eslint-disable-next-line class-methods-use-this
  async removeAnalyticsData(): Promise<void> {
    try {
      logger.info("Removing analytics data")
    } catch (e) {
      logger.error("Deleting Analytics Data Failed ", e)
    }
  }
}
