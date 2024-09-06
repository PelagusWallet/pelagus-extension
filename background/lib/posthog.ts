import { v4 as uuidv4 } from "uuid"
import logger from "./logger"

export enum AnalyticsEvent {
  NEW_INSTALL = "New install",
  UI_SHOWN = "UI shown",
  ACCOUNT_NAME_EDITED = "Account Name Edited",
  ANALYTICS_TOGGLED = "Analytics Toggled",
  DEFAULT_WALLET_TOGGLED = "Default Wallet Toggled",
  PELAGUS_NOTIFICATIONS_TOGGLED = "Show Pelagus notifications Toggled",
  TRANSACTION_SIGNED = "Transaction Signed",
  NEW_ACCOUNT_TO_TRACK = "Address added to tracking on network",
  CUSTOM_CHAIN_ADDED = "Custom chain added",
  DAPP_CONNECTED = "Dapp Connected",
}

export enum OneTimeAnalyticsEvent {
  ONBOARDING_STARTED = "Onboarding Started",
  ONBOARDING_FINISHED = "Onboarding Finished",
  CHAIN_ADDED = "Chain Added",
}

export const isOneTimeAnalyticsEvent = (
  eventName: string
): eventName is OneTimeAnalyticsEvent => {
  return Object.values<string>(OneTimeAnalyticsEvent).includes(eventName)
}

const POSTHOG_PROJECT_ID = "0"
const PERSON_ENDPOINT = `https://app.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/persons`
export const POSTHOG_URL =
  process.env.POSTHOG_URL ?? "https://app.posthog.com/capture/"
export const { USE_ANALYTICS_SOURCE } = process.env

export function shouldSendPosthogEvents(): boolean {
  return false // FIXME I haven't deleted yet, maybe there will be logic in the future
}

export function createPosthogPayload(
  personUUID: string,
  eventName: string,
  payload?: Record<string, unknown>
): string {
  return JSON.stringify({
    // See posthog Data model: https://posthog.com/docs/how-posthog-works/data-model
    uuid: uuidv4(),
    distinct_id: personUUID,
    api_key: process.env.POSTHOG_API_KEY,
    event: eventName,
    timestamp: new Date().toISOString(),
    properties: {
      // $lib property name is a convention used by posthog to send in the source property.
      // We want to separate events based on which context/phase/source they originate from
      // The intended context/phase/source at the moment of writing: DEV, BETA, PROD
      // This can be overwritten in .env so devs can check their events during dev
      $lib: USE_ANALYTICS_SOURCE,
      // properties[$current_url] is a convention used by posthog
      // Let's store the URL so we can differentiate between the sources later on.
      $current_url: self.location.href,
      ...payload,
    },
  })
}

export function sendPosthogEvent(
  personUUID: string,
  eventName: string,
  payload?: Record<string, unknown>
): void {
  try {
    if (!shouldSendPosthogEvents()) return // FIXME in fact, we always exit the function

    fetch(POSTHOG_URL, {
      method: "POST",
      body: createPosthogPayload(personUUID, eventName, payload),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
  } catch (e) {
    logger.debug("Sending analytics event failed with error: ", e)
  }
}

export async function getPersonId(personUUID: string): Promise<string> {
  const res = await fetch(`${PERSON_ENDPOINT}?distinct_id=${personUUID}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
    },
  })

  const response = await res.json()
  return response.results[0].id
}

export function deletePerson(personID: string): void {
  fetch(`${PERSON_ENDPOINT}/${personID}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
    },
  })
}
