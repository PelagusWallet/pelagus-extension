import {
  isTrustedBackgroundSender,
  isTrustedExtensionPageSender,
} from "../offscreen-clipboard-messages"

const EXTENSION_ID = "pelagus-extension-id"
const EXTENSION_ROOT = `chrome-extension://${EXTENSION_ID}/`

describe("sensitive clipboard sender authorization", () => {
  it("accepts extension pages and rejects injected content scripts", () => {
    expect(
      isTrustedExtensionPageSender(
        {
          id: EXTENSION_ID,
          url: `${EXTENSION_ROOT}popup.html`,
        },
        EXTENSION_ID,
        EXTENSION_ROOT
      )
    ).toBe(true)

    expect(
      isTrustedExtensionPageSender(
        {
          id: EXTENSION_ID,
          url: "https://compromised-dapp.example",
        },
        EXTENSION_ID,
        EXTENSION_ROOT
      )
    ).toBe(false)
  })

  it("requires the exact background service-worker URL", () => {
    expect(
      isTrustedBackgroundSender(
        {
          id: EXTENSION_ID,
          url: `${EXTENSION_ROOT}background.js`,
        },
        EXTENSION_ID,
        `${EXTENSION_ROOT}background.js`
      )
    ).toBe(true)

    expect(
      isTrustedBackgroundSender(
        {
          id: EXTENSION_ID,
          url: `${EXTENSION_ROOT}popup.html`,
        },
        EXTENSION_ID,
        `${EXTENSION_ROOT}background.js`
      )
    ).toBe(false)
  })

  it("rejects a different extension ID", () => {
    expect(
      isTrustedExtensionPageSender(
        {
          id: "another-extension-id",
          url: `${EXTENSION_ROOT}popup.html`,
        },
        EXTENSION_ID,
        EXTENSION_ROOT
      )
    ).toBe(false)
    expect(
      isTrustedBackgroundSender(
        {
          id: "another-extension-id",
          url: `${EXTENSION_ROOT}background.js`,
        },
        EXTENSION_ID,
        `${EXTENSION_ROOT}background.js`
      )
    ).toBe(false)
  })
})
