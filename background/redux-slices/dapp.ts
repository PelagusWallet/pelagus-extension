import { createSlice } from "@reduxjs/toolkit"
import Emittery from "emittery"
import {
  DenyPermissionRequest,
  PermissionRequest,
} from "@pelagus-provider/provider-bridge-shared"
import { createBackgroundAsyncThunk } from "./utils"
import { keyPermissionsByChainIdAddressOrigin } from "../services/provider-bridge/utils"
import { QUAI_NETWORK } from "../constants"

export type DAppPermissionState = {
  permissionRequests: { [origin: string]: PermissionRequest }
  allowed: {
    evm: {
      // @TODO Re-key by origin-chainID-address
      [chainID: string]: {
        [address: string]: {
          [origin: string]: PermissionRequest
        }
      }
    }
  }
}

export const initialState: DAppPermissionState = {
  permissionRequests: {},
  allowed: { evm: {} },
}

export type Events = {
  requestPermission: PermissionRequest
  grantPermission: PermissionRequest
  denyOrRevokePermission: PermissionRequest
  denyDAppPermissions: PermissionRequest[]
  denyDAppPermissionForAddress: DenyPermissionRequest
}

export const emitter = new Emittery<Events>()

export const grantPermission = createBackgroundAsyncThunk(
  "dapp-permission/permissionGrant",
  async (permission: PermissionRequest) => {
    await emitter.emit("grantPermission", permission)
    return permission
  }
)

export const denyOrRevokePermission = createBackgroundAsyncThunk(
  "dapp-permission/permissionDenyOrRevoke",
  async (permission: PermissionRequest) => {
    await emitter.emit("denyOrRevokePermission", permission)
    return permission
  }
)

export const denyDAppPermissions = createBackgroundAsyncThunk(
  "dapp-permission/denyDAppPermissions",
  async (permissions: PermissionRequest[]) => {
    await emitter.emit("denyDAppPermissions", permissions)
    return permissions
  }
)

export const denyDAppPermissionForAddress = createBackgroundAsyncThunk(
  "dapp-permission/denyDAppPermissionForAddress",
  async ({ permission, accountAddress }: DenyPermissionRequest) => {
    await emitter.emit("denyDAppPermissionForAddress", {
      permission,
      accountAddress,
    })
    return permission
  }
)

const dappSlice = createSlice({
  name: "dapp-permission",
  initialState,
  reducers: {
    initializePermissions: (
      immerState,
      {
        payload: allowed,
      }: {
        payload: {
          evm: {
            [chainID: string]: {
              [address: string]: {
                [origin: string]: PermissionRequest
              }
            }
          }
        }
      }
    ) => {
      immerState.allowed = allowed
    },
    requestPermission: (
      state,
      { payload: request }: { payload: PermissionRequest }
    ) => {
      if (state.permissionRequests[request.origin]?.state !== "allow") {
        return {
          ...state,
          permissionRequests: {
            // Quick fix: store only the latest permission request.
            // TODO: put this back when we fixed the performance issues and/or updated our UI to handle multiple requests
            // ...state.permissionRequests,
            [request.origin]: { ...request },
          },
        }
      }

      return state
    },
    revokePermissionsForAddress: (
      immerState,
      { payload: address }: { payload: string }
    ) => {
      Object.keys(immerState.allowed.evm).forEach((chainID) => {
        if (immerState.allowed.evm[chainID]?.[address]) {
          const { [address]: _, ...withoutAddressToRemove } =
            immerState.allowed.evm[chainID]

          immerState.allowed.evm[chainID] = withoutAddressToRemove
        }
      })
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(
        grantPermission.fulfilled,
        (
          immerState,
          { payload: permission }: { payload: PermissionRequest }
        ) => {
          const updatedPermissionRequests = { ...immerState.permissionRequests }
          delete updatedPermissionRequests[permission.origin]

          // Support all networks regardless of which one initiated grant request
          const permissions = [QUAI_NETWORK].map((network) => ({
            ...permission,
            chainID: network.chainID,
          }))

          const allowedPermission = keyPermissionsByChainIdAddressOrigin(
            permissions,
            immerState.allowed
          )

          immerState.allowed = allowedPermission
        }
      )
      .addCase(
        denyOrRevokePermission.fulfilled,
        (
          immerState,
          { payload: permission }: { payload: PermissionRequest }
        ) => {
          const updatedPermissionRequests = { ...immerState.permissionRequests }
          delete updatedPermissionRequests[permission.origin]

          Object.keys(immerState.allowed.evm).forEach((chainID) => {
            if (immerState.allowed.evm[chainID]?.[permission.accountAddress]) {
              const { [permission.origin]: _, ...withoutOriginToRemove } =
                immerState.allowed.evm[chainID][permission.accountAddress]
              immerState.allowed.evm[chainID][permission.accountAddress] =
                withoutOriginToRemove
            }
          })
        }
      )
      .addCase(
        denyDAppPermissionForAddress.fulfilled,
        (
          immerState,
          { payload: permission }: { payload: PermissionRequest }
        ) => {
          const updatedPermissionRequests = { ...immerState.permissionRequests }
          delete updatedPermissionRequests[permission.origin]

          Object.keys(immerState.allowed.evm).forEach((chainID) => {
            if (immerState.allowed.evm[chainID]?.[permission.accountAddress]) {
              if (
                immerState.allowed.evm[chainID][permission.accountAddress][
                  permission.origin
                ]
              ) {
                delete immerState.allowed.evm[chainID][
                  permission.accountAddress
                ][permission.origin]
              }
            }
          })
        }
      )
      .addCase(
        denyDAppPermissions.fulfilled,
        (
          immerState,
          { payload: permissions }: { payload: PermissionRequest[] }
        ) => {
          permissions.forEach((permission) => {
            const updatedPermissionRequests = {
              ...immerState.permissionRequests,
            }
            delete updatedPermissionRequests[permission.origin]

            Object.keys(immerState.allowed.evm).forEach((chainID) => {
              if (
                immerState.allowed.evm[chainID]?.[permission.accountAddress]
              ) {
                const { [permission.origin]: _, ...withoutOriginToRemove } =
                  immerState.allowed.evm[chainID][permission.accountAddress]
                immerState.allowed.evm[chainID][permission.accountAddress] =
                  withoutOriginToRemove
              }
            })
          })
        }
      )
  },
})

export const {
  requestPermission,
  initializePermissions,
  revokePermissionsForAddress,
} = dappSlice.actions

export default dappSlice.reducer
