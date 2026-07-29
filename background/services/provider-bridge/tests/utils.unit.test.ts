import {
  EIP1193Error,
  EIP1193_ERROR_CODES,
  isEIP1193Error,
} from "@pelagus-provider/provider-bridge-shared"
import { handleRPCErrorResponse } from "../utils"

describe("Utils", () => {
  describe("handleRPCErrorResponse", () => {
    it("should return a provider Rpc error", () => {
      const response = handleRPCErrorResponse(
        new EIP1193Error(EIP1193_ERROR_CODES.disconnected)
      )
      expect(response).toBe(EIP1193_ERROR_CODES.disconnected)
    })

    it("should return a custom error when a message is in the body", () => {
      const error = {
        body: JSON.stringify({
          error: {
            message: "Custom error",
          },
        }),
      }
      const response = handleRPCErrorResponse(error)
      expect(response).toStrictEqual({ code: -32603, message: "Custom error" })
    })

    it("should return a custom error when a message is nested in the error object", () => {
      const error = {
        error: {
          body: JSON.stringify({
            error: {
              message: "Custom error",
            },
          }),
        },
      }
      const response = handleRPCErrorResponse(error)
      expect(response).toStrictEqual({ code: -32603, message: "Custom error" })
    })

    it("should preserve the message from an ordinary Error", () => {
      const response = handleRPCErrorResponse(
        new Error("Gas estimation reverted")
      )
      expect(response).toStrictEqual({
        code: -32603,
        message: "Gas estimation reverted",
      })
      expect(isEIP1193Error(response)).toBe(true)
    })

    it("should return an internal error when it cannot handle the error", () => {
      const error = {
        error: {
          body: {
            error: {
              message: "Custom error",
            },
          },
        },
      }
      const response = handleRPCErrorResponse(error)
      expect(response).toStrictEqual({
        code: -32603,
        message: "Internal JSON-RPC error.",
      })
    })

    it("should preserve an explicit user rejection", () => {
      const response = handleRPCErrorResponse(
        new EIP1193Error(EIP1193_ERROR_CODES.userRejectedRequest)
      )
      expect(response).toBe(EIP1193_ERROR_CODES.userRejectedRequest)
    })
  })
})
