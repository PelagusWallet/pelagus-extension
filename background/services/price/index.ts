import browser from "webextension-polyfill"
import Emittery from "emittery"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import BaseService, { AlarmHandlerScheduleMap } from "../base"
import { PreferenceService } from ".."
import { FungibleAsset } from "../../assets"
import { QUAI, USD } from "../../constants"
import logger from "../../lib/logger"

interface PriceServiceEvents extends ServiceLifecycleEvents {
  priceUpdated: {
    quaiUsdRate: number
    pricePoint: {
      pair: [FungibleAsset, FungibleAsset]
      amounts: [bigint, bigint]
      time: number
    }
  }
}

export const QUAI_USD_PRICE_ALARM = "quai-usd-price-alarm"

/**
 * The PriceService is responsible for fetching and managing asset prices,
 * particularly the QUAI to USD exchange rate.
 */
export default class PriceService extends BaseService<PriceServiceEvents> {
  // API endpoint for fetching QUAI price
  private static readonly API_URL = "https://api.qu.ai/price"

  // Fallback exchange rate - $0.10 per QUAI
  private static readonly FALLBACK_QUAI_TO_USD_RATE = 0.1

  // Maximum number of retry attempts
  private static readonly MAX_RETRY_ATTEMPTS = 10

  // Base delay for exponential backoff in milliseconds
  private static readonly BASE_RETRY_DELAY = 300

  // Current exchange rate
  private currentRate = PriceService.FALLBACK_QUAI_TO_USD_RATE

  // Fetch promise to avoid multiple concurrent fetches
  private fetchPromise: Promise<number> | null = null

  /**
   * Create a price service connected to the specified preferences service.
   */
  static create: ServiceCreatorFunction<
    PriceServiceEvents,
    PriceService,
    [Promise<PreferenceService>]
  > = async (preferenceService) => {
    return new PriceService(await preferenceService)
  }

  private constructor(private preferenceService: PreferenceService) {
    super(PriceService.getAlarmSchedules())
  }

  private static getAlarmSchedules(): AlarmHandlerScheduleMap {
    return {
      [QUAI_USD_PRICE_ALARM]: {
        // Schedule to run every 5 minutes
        schedule: { periodInMinutes: 2 },
        handler: async () => {
          // The actual handler is implemented in handleAlarm
        },
        runAtStart: true,
      },
    }
  }

  /**
   * Handle alarm events for price updates
   */
  protected override handleAlarm(alarm: browser.Alarms.Alarm): void {
    if (alarm.name === QUAI_USD_PRICE_ALARM) {
      this.updateQuaiPrice().catch((error) => {
        logger.error("Failed to update QUAI price:", error)
      })
    } else {
      super.handleAlarm(alarm)
    }
  }

  /**
   * Update the QUAI price and emit an event with the updated price
   */
  private async updateQuaiPrice(): Promise<void> {
    try {
      const rate = await this.fetchExchangeRate()
      const pricePoint = await this.buildQuaiUsdPricePoint(rate)
      this.emitter.emit("priceUpdated", {
        quaiUsdRate: rate,
        pricePoint,
      })
    } catch (error) {
      logger.error("Error updating QUAI price:", error)
    }
  }

  /**
   * Fetch the current QUAI to USD exchange rate from the API
   * @returns Promise resolving to the exchange rate
   */
  private async fetchExchangeRate(): Promise<number> {
    // If there's an ongoing fetch, return that promise
    if (this.fetchPromise) {
      return this.fetchPromise
    }

    // Create new fetch promise with retry logic
    this.fetchPromise = (async (): Promise<number> => {
      for (
        let attempt = 0;
        attempt < PriceService.MAX_RETRY_ATTEMPTS;
        attempt += 1
      ) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const response = await fetch(PriceService.API_URL)
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`)
          }

          // eslint-disable-next-line no-await-in-loop
          const data = await response.json()
          if (!data.price || typeof data.price !== "number") {
            throw new Error("Invalid price data received")
          }

          this.currentRate = data.price
          return this.currentRate
        } catch (error) {
          // Calculate delay with exponential backoff
          const delay = PriceService.BASE_RETRY_DELAY * 2 ** attempt

          // Log the error but only on the last attempt
          if (attempt === PriceService.MAX_RETRY_ATTEMPTS - 1) {
            logger.error(
              "Failed to fetch QUAI exchange rate, using fallback rate:",
              error
            )
          }

          // Wait before next retry
          if (attempt < PriceService.MAX_RETRY_ATTEMPTS - 1) {
            // Use a promise that resolves after the delay to avoid blocking
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      }

      // If all retries failed, return fallback rate
      return PriceService.FALLBACK_QUAI_TO_USD_RATE
    })()

    try {
      const rate = await this.fetchPromise
      return rate
    } finally {
      // Clear the fetch promise after completion
      this.fetchPromise = null
    }
  }

  /**
   * Get the current QUAI to USD exchange rate
   * @returns Promise resolving to the current exchange rate
   */
  async getQuaiUsdRate(): Promise<number> {
    return this.fetchExchangeRate()
  }

  /**
   * Builds a price point for QUAI -> USD based on the current exchange rate
   * @param rate The QUAI to USD rate to use
   */
  private buildQuaiUsdPricePoint(rate: number): {
    pair: [FungibleAsset, FungibleAsset]
    amounts: [bigint, bigint]
    time: number
  } {
    // For USD, store 5 decimal places of precision (multiply by 10^5)
    // This preserves much more precision for small USD values
    const usdAmount = BigInt(Math.round(rate * 100000))

    // For QUAI with 18 decimals, use 10^18 for one whole unit
    const quaiAmount = 10n ** 18n

    return {
      pair: [QUAI, USD],
      amounts: [quaiAmount, usdAmount],
      time: Math.floor(Date.now() / 1000),
    }
  }

  /**
   * Get a price point for QUAI -> USD
   */
  async getQuaiUsdPricePoint(): Promise<{
    pair: [FungibleAsset, FungibleAsset]
    amounts: [bigint, bigint]
    time: number
  }> {
    const rate = await this.getQuaiUsdRate()
    return this.buildQuaiUsdPricePoint(rate)
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService()

    // Immediately fetch price on start
    this.updateQuaiPrice().catch((error) => {
      logger.error("Failed to fetch initial QUAI price:", error)
    })
  }
}
