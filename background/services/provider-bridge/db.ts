import Dexie from "dexie"
import { PermissionRequest } from "@pelagus-provider/provider-bridge-shared"

import { keyPermissionsByChainIdAddressOrigin, PermissionMap } from "./utils"

export class ProviderBridgeDatabase extends Dexie {
  private dAppPermissions!: Dexie.Table<PermissionRequest, string>

  constructor() {
    super("pelagus/provider-bridge-service")
    this.version(1).stores({
      migrations: "++id,appliedAt",
      dAppPermissions:
        "&[origin+accountAddress+chainID],origin,accountAddress,chainID",
    })
  }

  async getAllPermission(): Promise<PermissionMap> {
    const permissions = await this.dAppPermissions.toArray()
    return keyPermissionsByChainIdAddressOrigin(permissions)
  }

  async setPermission(
    permission: PermissionRequest
  ): Promise<string | undefined> {
    return this.dAppPermissions.put(permission)
  }

  async deletePermission(
    origin: string,
    accountAddress: string,
    chainID: string
  ): Promise<number> {
    return this.dAppPermissions
      .where({ origin, accountAddress, chainID })
      .delete()
  }

  async deletePermissionByOriginAndChain(
    origin: string,
    chainID: string
  ): Promise<number> {
    return this.dAppPermissions.where({ origin, chainID }).delete()
  }

  async deletePermissionByAddress(accountAddress: string): Promise<number> {
    return this.dAppPermissions.where({ accountAddress }).delete()
  }

  async deletePermissionsByChain(chainID: string): Promise<number> {
    return this.dAppPermissions.where({ chainID }).delete()
  }

  async checkPermission(
    origin: string,
    accountAddress: string,
    chainID: string
  ): Promise<PermissionRequest | undefined> {
    return this.dAppPermissions.get({ origin, accountAddress, chainID })
  }
}

export async function initializeProviderBridgeDatabase(): Promise<ProviderBridgeDatabase> {
  return new ProviderBridgeDatabase()
}
