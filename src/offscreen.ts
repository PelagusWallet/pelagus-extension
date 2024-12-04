/* eslint-disable @typescript-eslint/no-use-before-define */

// As of Jan 2023, service workers cannot directly interact with
// the system clipboard using either `navigator.clipboard` or
// `document.execCommand()`. To work around this, we'll create an offscreen
// document and pass it the data we want to write to the clipboard.
export async function addToOffscreenClipboardSensitiveData(
  value: string
): Promise<void> {
  // Check if the offscreen document still exists
  const offscreenExists = await chrome.offscreen.hasDocument()

  if (!offscreenExists) {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: [chrome.offscreen.Reason.CLIPBOARD],
        justification: "Write text to the clipboard.",
      })
    } catch (error: any) {
      console.error(`Failed to create offscreen document: ${error.message}`)
      return
    }
  }

  // Now that we have an offscreen document, we can dispatch the message.
  chrome.runtime.sendMessage({
    type: "copy-data-to-clipboard",
    target: "offscreen-doc",
    data: value,
  })
}

// Registering this listener when the script is first executed ensures that the
// offscreen document will be able to receive messages when the promise returned
// by `offscreen.createDocument()` resolves.
chrome.runtime.onMessage.addListener(handleMessages)

// This function performs basic filtering and error checking on messages before
// dispatching the
// message to a more specific message handler.
async function handleMessages(message: {
  target: string
  data: string
  type: string
}) {
  // Return early if this message isn't meant for the offscreen document.
  if (message.target !== "offscreen-doc") {
    return
  }

  // Dispatch the message to an appropriate handler.
  switch (message.type) {
    case "copy-data-to-clipboard":
      handleClipboardWrite(message.data)
      break
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`)
  }
}

// We use a <textarea> element for two main reasons:
//  1. preserve the formatting of multiline text,
//  2. select the node's content using this element's `.select()` method.
const textEl = document.querySelector("#text") as any

// Use the offscreen document's `document` interface to write a new value to the
// system clipboard.
//
// At the time this demo was created (Jan 2023) the `navigator.clipboard` API
// requires that the window is focused, but offscreen documents cannot be
// focused. As such, we have to fall back to `document.execCommand()`.
async function handleClipboardWrite(data: string) {
  try {
    // `document.execCommand('copy')` works against the user's selection in a web
    // page. As such, we must insert the string we want to copy to the web page
    // and to select that content in the page before calling `execCommand()`.
    textEl.value = data
    textEl?.select()
    document.execCommand("copy")

    setTimeout(() => {
      textEl.value = " "
      textEl?.select()
      document.execCommand("copy")
    }, 60000)
  } catch (e) {
    console.error(e)
  }
}
