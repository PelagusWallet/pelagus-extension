import { JsonRpcProvider } from "quais"
import { ERC20_INTERFACE } from "../../contracts/erc-20"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { getTokenBalancesByRpcBatch } from "../erc20"

jest.mock("webextension-polyfill", () => ({
  __esModule: true,
  default: {},
}))

describe("getTokenBalancesByRpcBatch", () => {
  it("issues all balance calls and isolates a failing token", async () => {
    const tokenA = "0x002b2596EcF05C93a31ff916E8b456DF6C77c750"
    const tokenB = "0x006C3e2AaAE5DB1bCd11A1a097cE572312EADdBB"
    const failingToken = "0x0049F7cbCa3556C2DfaE62Aafa7015F99de1b8f5"
    const call = jest.fn(async ({ to }: { to: string }) => {
      if (to.toLowerCase() === failingToken.toLowerCase()) {
        throw new Error("token call reverted")
      }

      const balance = to.toLowerCase() === tokenA.toLowerCase() ? 10n : 20n
      return ERC20_INTERFACE.encodeFunctionResult("balanceOf", [balance])
    })
    const provider = { call } as unknown as JsonRpcProvider
    const network = { chainID: "9" } as NetworkInterface

    const balances = await getTokenBalancesByRpcBatch(
      {
        address: "0x0028769266a20b9FE14Bb3b9871b07621A611680",
        network,
      },
      [tokenA, tokenB, failingToken],
      provider
    )

    expect(call).toHaveBeenCalledTimes(3)
    expect(balances).toEqual([
      {
        amount: 10n,
        smartContract: { contractAddress: tokenA, homeNetwork: network },
      },
      {
        amount: 20n,
        smartContract: { contractAddress: tokenB, homeNetwork: network },
      },
    ])
  })
})
