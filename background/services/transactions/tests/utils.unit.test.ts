import { QuaiTransactionResponse } from "quais/lib/commonjs/providers"

import { TransactionStatus } from "../types"
import { quaiTransactionFromResponse } from "../utils"
import type { TransactionAnnotation } from "../../enrichment/types"

describe("transaction utilities", () => {
  it("preserves a locally decoded annotation on a pending transaction", () => {
    const annotation: TransactionAnnotation = {
      type: "external-transfer",
      timestamp: Date.now(),
      blockTimestamp: undefined,
    }
    const response = {
      to: "0x0010000000000000000000000000000000000000",
      from: "0x0020000000000000000000000000000000000000",
      chainId: 9n,
      hash: `0x00${"00".repeat(31)}`,
      data: "0x",
      gasLimit: 21_000n,
      gasPrice: 1n,
      nonce: 0,
      type: 0,
      value: 0n,
      index: 0n,
    } as unknown as QuaiTransactionResponse

    const transaction = quaiTransactionFromResponse(
      response,
      TransactionStatus.PENDING,
      annotation
    )

    expect(transaction.annotation).toBe(annotation)
  })
})
