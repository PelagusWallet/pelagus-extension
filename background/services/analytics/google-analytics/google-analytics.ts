export function initializeGoogleAnalytics(measurementId: string) {
  const script = document.createElement("script")
  script.src = chrome.runtime.getURL("scripts/gtag.js")
  script.async = true
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag(...args: any[]) {
    ;(window.dataLayer as any).push(args)
  }
  window.gtag = gtag

  gtag("js", new Date())
  gtag("config", measurementId, { send_page_view: false })
}
export function trackEvent(
  eventName: string,
  category: string,
  label?: string,
  value?: number
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, {
      event_category: category,
      event_label: label,
      value,
    })
  }
}
