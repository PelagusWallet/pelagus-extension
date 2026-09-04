import { Zone } from "quais"
import { QuaiOrchardTestnet } from "../../../constants/networks/networks"
import ChainService from "../../chain"
import KeyringService from "../../keyring"
import TransactionService from "../../transactions"
import SigningService from ".."

describe("SigningService.signData", () => {
  it("rejects an empty Qi signature instead of emitting success", async () => {
    const keyringService = {
      signMessageWithAllQiAddresses: jest.fn().mockResolvedValue(""),
    } as unknown as KeyringService
    const chainService = {
      syncQiWallet: jest.fn().mockResolvedValue(undefined),
    } as unknown as ChainService
    const signingService = await SigningService.create(
      Promise.resolve(keyringService),
      Promise.resolve(chainService),
      Promise.resolve({} as TransactionService)
    )
    const emit = jest.spyOn(signingService.emitter, "emit")

    await expect(
      signingService.signData(
        {
          address: "0x0000000000000000000000000000000000000000",
          network: QuaiOrchardTestnet,
        },
        "0x1234",
        { type: "keyring", keyringID: "test", zone: Zone.Cyprus1 },
        "qi"
      )
    ).rejects.toThrow("Signing returned an empty signature")

    expect(emit).not.toHaveBeenCalledWith(
      "personalSigningResponse",
      expect.objectContaining({ type: "success-data" })
    )
    expect(emit).toHaveBeenCalledWith(
      "personalSigningResponse",
      expect.objectContaining({ type: "error" })
    )
  })
})
