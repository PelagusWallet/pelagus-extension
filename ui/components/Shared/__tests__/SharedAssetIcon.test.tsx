import React from "react"
import { render, waitFor } from "@testing-library/react"
import SharedAssetIcon from "../SharedAssetIcon"

const BOSS_ADDRESS = "0x004AFDb66677D177B759356D2367AeA3A79Fe58b"
const BOSS_ICON_URL =
  "https://explorer.qu.ai/api/token/0x004afdb66677d177b759356d2367aea3a79fe58b/icon"

class MockIntersectionObserver {
  private observedTargets = new Set<Element>()

  constructor(private callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.observedTargets.add(target)
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    )
  }

  unobserve(target: Element) {
    this.observedTargets.delete(target)
  }
}

describe("SharedAssetIcon", () => {
  const originalImage = window.Image

  beforeAll(() => {
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    window.Image = originalImage
  })

  test("should render asset icon ", () => {
    const ui = render(
      <SharedAssetIcon
        size="small"
        symbol="USDC"
        logoURL="http://localhost:8097/supercoolassetlogo.jpg"
      />
    )

    expect(ui.getByRole("img")).toBeInTheDocument()
    expect(ui.getByRole("img")).toBeVisible()
  })

  test("should handle assets with invalid symbols", () => {
    const ui = render(
      <SharedAssetIcon
        size="small"
        symbol=""
        logoURL="http://localhost:8097/supercoolassetlogo.jpg"
      />
    )

    expect(ui.getByRole("img")).toBeInTheDocument()
    expect(ui.getByRole("img")).toBeVisible()
    expect(ui.getByText("?")).toBeVisible()
  })

  test("loads an Explorer icon from a mainnet token address", async () => {
    const imageConstructor = jest.fn().mockImplementation(() => {
      let imageSource = ""
      const image = {
        onerror: null as (() => void) | null,
        onload: null as (() => void) | null,
        referrerPolicy: "",
      }

      Object.defineProperty(image, "src", {
        get: () => imageSource,
        set: (value: string) => {
          imageSource = value
          image.onload?.()
        },
      })
      Object.preventExtensions(image)

      return image
    })

    window.Image = imageConstructor as unknown as typeof Image

    const ui = render(
      <SharedAssetIcon
        size="small"
        symbol="BOSS"
        contractAddress={BOSS_ADDRESS}
        chainID="9"
      />
    )

    await waitFor(() =>
      expect(ui.container.querySelector("img")).toHaveAttribute(
        "src",
        BOSS_ICON_URL
      )
    )
  })
})
