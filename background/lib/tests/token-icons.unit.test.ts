import {
  QuaiMainnet,
  QuaiOrchardTestnet,
} from "../../constants/networks/networks"
import { getExplorerTokenIconURL, withExplorerTokenIcon } from "../token-icons"

const BOSS_ADDRESS = "0x004AFDb66677D177B759356D2367AeA3A79Fe58b"
const BOSS_ICON_URL =
  "https://explorer.qu.ai/api/token/0x004afdb66677d177b759356d2367aea3a79fe58b/icon"

describe("Explorer token icons", () => {
  it("constructs the mainnet icon URL with a normalized address", () => {
    expect(getExplorerTokenIconURL(BOSS_ADDRESS, "9")).toBe(BOSS_ICON_URL)
  })

  it("adds an Explorer icon to a mainnet contract asset", () => {
    const asset = {
      name: "BOSS",
      symbol: "BOSS",
      decimals: 18,
      contractAddress: BOSS_ADDRESS,
      homeNetwork: QuaiMainnet,
    }

    expect(withExplorerTokenIcon(asset)).toEqual({
      ...asset,
      metadata: { logoURL: BOSS_ICON_URL },
    })
  })

  it("preserves explicit token artwork", () => {
    const asset = {
      name: "BOSS",
      symbol: "BOSS",
      decimals: 18,
      contractAddress: BOSS_ADDRESS,
      homeNetwork: QuaiMainnet,
      metadata: { logoURL: "https://tokens.example/boss.png" },
    }

    expect(withExplorerTokenIcon(asset)).toBe(asset)
  })

  it("does not use the mainnet Explorer for other networks", () => {
    const asset = {
      name: "TEST",
      symbol: "TEST",
      decimals: 18,
      contractAddress: BOSS_ADDRESS,
      homeNetwork: QuaiOrchardTestnet,
    }

    expect(withExplorerTokenIcon(asset)).toBe(asset)
  })

  it("rejects malformed contract addresses", () => {
    expect(getExplorerTokenIconURL("../../not-an-address", "9")).toBeUndefined()
  })
})
