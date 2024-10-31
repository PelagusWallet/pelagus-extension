import browser from "webextension-polyfill"
import { AllowedQueryParamPageType } from "@pelagus-provider/provider-bridge-shared"

export default async function showExtensionPopup(
  url: AllowedQueryParamPageType,
  additionalOptions: { [key: string]: string } = {},
  onClose?: () => void,
): Promise<browser.Windows.Window> {
  const { left = 0, top, width = 1920 } = await browser.windows.getCurrent()
  const popupWidth = 384
  const popupHeight = 628

  const queryString = new URLSearchParams({
    ...additionalOptions,
    page: url,
  }).toString()

  const params: browser.Windows.CreateCreateDataType = {
    url: `${browser.runtime.getURL("popup.html")}?${queryString}`,
    type: "popup",
    left: left + width - popupWidth,
    top,
    width: popupWidth,
    height: popupHeight,
    focused: true,
  }


  const window = await browser.windows.create(params)

  if (onClose !== undefined) {
    const listener = (windowId: number) => {
      if (windowId === window.id) {
        onClose()

        browser.windows.onRemoved.removeListener(listener)
      }
    }
    browser.windows.onRemoved.addListener(listener)
  }

  return window
}
