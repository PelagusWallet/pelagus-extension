import {
  EIP1193Error,
  EIP1193_ERROR_CODES,
  PermissionRequest,
} from "@pelagus-provider/provider-bridge-shared"
import { BigNumberish } from "quais"
import { sameQuaiAddress } from "../../lib/utils"
import { toHexChainID } from "../../networks"
import { HexString } from "../../types"

export function checkPermissionSignTypedData(
  walletAddress: HexString,
  enablingPermission: PermissionRequest
): void {
  if (
    enablingPermission.state !== "allow" ||
    !sameQuaiAddress(walletAddress, enablingPermission.accountAddress)
  ) {
    throw new EIP1193Error(EIP1193_ERROR_CODES.unauthorized)
  }
}

export function checkPermissionSign(
  walletAddress: HexString,
  enablingPermission: PermissionRequest
): void {
  if (
    enablingPermission.state !== "allow" ||
    !sameQuaiAddress(walletAddress, enablingPermission.accountAddress)
  ) {
    throw new EIP1193Error(EIP1193_ERROR_CODES.unauthorized)
  }
}

export function checkPermissionSignTransaction(
  chainId: BigNumberish | undefined | null,
  from: string | undefined,
  enablingPermission: PermissionRequest
): void {
  if (
    chainId &&
    toHexChainID(Number(chainId)) !== toHexChainID(enablingPermission.chainID)
  ) {
    throw new EIP1193Error(EIP1193_ERROR_CODES.unauthorized)
  }

  if (
    enablingPermission.state !== "allow" ||
    !sameQuaiAddress(from, enablingPermission.accountAddress)
  ) {
    throw new EIP1193Error(EIP1193_ERROR_CODES.unauthorized)
  }
}
