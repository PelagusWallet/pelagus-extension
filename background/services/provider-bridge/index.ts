import browser, { Runtime } from "webextension-polyfill"
import {
  AllowedQueryParamPage,
  EIP1193_ERROR_CODES,
  EXTERNAL_PORT_NAME,
  PELAGUS_INTERNAL_COMMUNICATION_ID,
  PELAGUS_GET_CONFIG_METHOD,
  PELAGUS_HEALTH_CHECK_METHOD,
  PELAGUS_METHODS_PREFIX,
  PELAGUS_ACCOUNT_CHANGED_METHOD,
  isPelagusConfigPayload,
  isPelagusPortHealthCheck,
  EIP1193Error,
  PermissionRequest,
  PortRequestEvent,
  PortResponseEvent,
  RPCRequest,
} from "@pelagus-provider/provider-bridge-shared"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
import BaseService from "../base"
import InternalQuaiProviderService, {
  AddEthereumChainParameter,
} from "../internal-quai-provider"
import { initializeProviderBridgeDatabase, ProviderBridgeDatabase } from "./db"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import PreferenceService from "../preferences"
import logger from "../../lib/logger"
import {
  checkPermissionSign,
  checkPermissionSignTransaction,
  checkPermissionSignTypedData,
} from "./authorization"
import showExtensionPopup from "./show-popup"
import { HexString } from "../../types"
import {
  handleRPCErrorResponse,
  parseRPCRequestParams,
  PermissionMap,
  validateAddEthereumChainParameter,
  ValidatedAddEthereumChainParameter,
} from "./utils"
import { toHexChainID } from "../../networks"
import { PELAGUS_INTERNAL_ORIGIN } from "../internal-quai-provider/constants"

type Events = ServiceLifecycleEvents & {
  requestPermission: PermissionRequest
  initializeAllowedPages: PermissionMap
}

export type AddChainRequestData = ValidatedAddEthereumChainParameter & {
  favicon: string
  siteTitle: string
}

/**
 * The ProviderBridgeService is responsible for the communication with the
 * provider-bridge (content-script).
 *
 * The main purpose for this service/layer is to provide a transition
 * between the untrusted communication from the window-provider - which runs
 * in shared dapp space and can be modified by other extensions - and our
 * internal service layer.
 *
 * The responsibility of this service is 2 fold.
 * - Provide connection interface - handle port communication, connect, disconnect etc
 * - Validate the incoming communication and make sure that what we receive is what we expect
 */
export default class ProviderBridgeService extends BaseService<Events> {
  #pendingPermissionsRequests: {
    [origin: string]: (value: unknown) => void
  } = {}

  #pendingAddNetworkRequests: {
    [id: string]: {
      resolve: () => void
      reject: () => void
      data: AddChainRequestData
    }
  } = {}

  private addNetworkRequestId = 0

  openPorts: Array<Runtime.Port> = []

  static create: ServiceCreatorFunction<
    Events,
    ProviderBridgeService,
    [Promise<InternalQuaiProviderService>, Promise<PreferenceService>]
  > = async (internalQuaiProviderService, preferenceService) => {
    return new this(
      await initializeProviderBridgeDatabase(),
      await internalQuaiProviderService,
      await preferenceService
    )
  }

  private constructor(
    private db: ProviderBridgeDatabase,
    private internalQuaiProviderService: InternalQuaiProviderService,
    private preferenceService: PreferenceService
  ) {
    super()

    browser.runtime.onConnect.addListener(async (port) => {
      if (port.name === EXTERNAL_PORT_NAME && port.sender?.url) {
        port.onMessage.addListener((event) => {
          this.onMessageListener(port as Required<browser.Runtime.Port>, event)
        })
        port.onDisconnect.addListener(() => {
          this.openPorts = this.openPorts.filter(
            (openPort) => openPort !== port
          )
        })
        this.openPorts.push(port)

        // we need to send this info ASAP so it arrives before the webpage is initializing
        // so we can set our provider into the correct state, BEFORE the page has a chance to
        // to cache it, store it etc.
        port.postMessage({
          id: PELAGUS_INTERNAL_COMMUNICATION_ID,
          jsonrpc: "2.0",
          result: {
            method: PELAGUS_GET_CONFIG_METHOD,
            defaultWallet: await this.preferenceService.getDefaultWallet(),
          },
        })
      }
      // TODO: on internal provider handlers connect, disconnect, account change, network change
    })
  }

  protected override async internalStartService(): Promise<void> {
    await super.internalStartService() // Not needed, but better to stick to the patterns
    await this.emitter.emit(
      "initializeAllowedPages",
      await this.db.getAllPermission()
    )
  }

  async onMessageListener(
    port: Required<browser.Runtime.Port>,
    event: PortRequestEvent
  ): Promise<void> {
    const { url, tab } = port.sender
    if (typeof url === "undefined") return

    const { origin } = new URL(url)

    const response: PortResponseEvent = {
      id: event.id,
      jsonrpc: "2.0",
      result: [],
    }
    const network =
      await this.internalQuaiProviderService.getCurrentOrDefaultNetworkForOrigin(
        origin
      )

    const originPermission = await this.checkPermission(origin, network.chainID)
    if (origin === PELAGUS_INTERNAL_ORIGIN) {
      // Explicitly disallow anyone who has managed to pretend to be the
      // internal provider.
      response.result = new EIP1193Error(
        EIP1193_ERROR_CODES.unauthorized
      ).toJSON()
    } else if (isPelagusConfigPayload(event.request)) {
      // let's start with the internal communication
      response.id = PELAGUS_INTERNAL_COMMUNICATION_ID
      response.result = {
        method: event.request.method,
        defaultWallet: await this.preferenceService.getDefaultWallet(),
        chainId: toHexChainID(network.chainID),
      }
    } else if (isPelagusPortHealthCheck(event.request)) {
      logger.info(
        `keeping port health '${PELAGUS_HEALTH_CHECK_METHOD}' request`
      )
      response.result = {
        method: event.request.method,
      }
    } else if (event.request.method.startsWith(PELAGUS_METHODS_PREFIX)) {
      switch (event.request.method) {
        default:
          logger.debug(
            `Unknown method ${event.request.method} in 'ProviderBridgeService'`
          )
      }

      response.result = null
    } else if (
      event.request.method === "quai_chainId" ||
      event.request.method === "net_version"
    ) {
      // we need to send back the chainId and net_version (a deprecated
      // precursor to eth_chainId) independent of dApp permission if we want to
      // be compliant with MM and web3-react We are calling the
      // `internalQuaiProviderService.routeSafeRPCRequest` directly here,
      // because the point of this exception is to provide the proper chainId
      // for the dApp, independent from the permissions.
      response.result =
        await this.internalQuaiProviderService.routeSafeRPCRequest(
          event.request.method,
          event.request.params,
          origin
        )
    } else if (typeof originPermission !== "undefined") {
      // if it's not internal but dapp has permission to communicate we proxy the request
      // TODO: here comes format validation
      response.result = await this.routeContentScriptRPCRequest(
        originPermission,
        event.request.method,
        event.request.params,
        origin
      )
    } else if (event.request.method === "quai_requestAccounts") {
      // if it's external communication AND the dApp does not have permission BUT asks for it
      // then let's ask the user what he/she thinks
      const selectedAccount = await this.preferenceService.getSelectedAccount()
      const { address: accountAddress } = selectedAccount

      // @TODO 7/12/21 Figure out underlying cause here
      const dAppChainID = Number(
        (await this.internalQuaiProviderService.routeSafeRPCRequest(
          "quai_chainId",
          [],
          origin
        )) as string
      ).toString()

      // these params are taken directly from the dapp website
      const [title, faviconUrl] = event.request.params as string[]
      const permissionRequest: PermissionRequest = {
        key: `${origin}_${accountAddress}_${dAppChainID}`,
        origin,
        chainID: dAppChainID,
        faviconUrl: faviconUrl || tab?.favIconUrl || "", // if favicon was not found on the website then try with browser's `tab`
        title,
        state: "request",
        accountAddress,
      }

      await this.requestPermission(permissionRequest)

      const persistedPermission = await this.checkPermission(
        origin,
        dAppChainID
      )
      if (typeof persistedPermission !== "undefined") {
        // if agrees then let's return the account data
        response.result = await this.routeContentScriptRPCRequest(
          persistedPermission,
          "quai_accounts",
          event.request.params,
          origin
        )

        // on dApp connection, persist the current network/origin state
        await this.internalQuaiProviderService.switchToSupportedNetwork(
          origin,
          network
        )
      } else {
        // if user does NOT agree, then reject
        response.result = new EIP1193Error(
          EIP1193_ERROR_CODES.userRejectedRequest
        ).toJSON()
      }
    } else if (event.request.method === "quai_accounts") {
      const dAppChainID = Number(
        (await this.internalQuaiProviderService.routeSafeRPCRequest(
          "quai_chainId",
          [],
          origin
        )) as string
      ).toString()

      const permission = await this.checkPermission(origin, dAppChainID)

      response.result = []

      if (permission) {
        response.result = await this.routeContentScriptRPCRequest(
          permission,
          "quai_accounts",
          event.request.params,
          origin
        )
      }
    } else {
      response.result = new EIP1193Error(
        EIP1193_ERROR_CODES.unauthorized
      ).toJSON()
    }

    port.postMessage(response)
  }

  notifyContentScriptAboutConfigChange(newDefaultWalletValue: boolean): void {
    this.openPorts.forEach((p) => {
      p.postMessage({
        id: PELAGUS_INTERNAL_COMMUNICATION_ID,
        result: {
          method: PELAGUS_GET_CONFIG_METHOD,
          defaultWallet: newDefaultWalletValue,
          shouldReload: true,
        },
      })
    })
  }

  notifyContentScriptsAboutAddressChange(newAddress?: string): void {
    this.openPorts.forEach(async (port) => {
      const { origin } = new URL(port.sender?.url as string)
      const { chainID } =
        await this.internalQuaiProviderService.getCurrentOrDefaultNetworkForOrigin(
          origin
        )
      if (await this.checkPermission(origin, chainID)) {
        port.postMessage({
          id: PELAGUS_INTERNAL_COMMUNICATION_ID,
          result: {
            method: PELAGUS_ACCOUNT_CHANGED_METHOD,
            address: [newAddress],
          },
        })
      } else {
        port.postMessage({
          id: PELAGUS_INTERNAL_COMMUNICATION_ID,
          result: {
            method: PELAGUS_ACCOUNT_CHANGED_METHOD,
            address: [],
          },
        })
      }
    })
  }

  async requestPermission(
    permissionRequest: PermissionRequest
  ): Promise<unknown> {
    this.emitter.emit("requestPermission", permissionRequest)
    await showExtensionPopup(AllowedQueryParamPage.dappPermission)

    return new Promise((resolve) => {
      this.#pendingPermissionsRequests[permissionRequest.origin] = resolve
    })
  }

  async grantPermission(permission: PermissionRequest): Promise<void> {
    // FIXME proper error handling if this happens - should not tho
    if (permission.state !== "allow") {
      logger.error(
        `Invalid state received when granting permission. Expected 'allow' but got '${permission.state}'.`
      )
      return
    }
    if (!permission.accountAddress) {
      logger.error("Empty account address received when granting permission.")
      return
    }

    await this.db.setPermission(permission)

    if (this.#pendingPermissionsRequests[permission.origin]) {
      this.#pendingPermissionsRequests[permission.origin](permission)
      delete this.#pendingPermissionsRequests[permission.origin]
    }
  }

  async denyOrRevokePermission(permission: PermissionRequest): Promise<void> {
    // FIXME proper error handling if this happens - should not tho
    if (permission.state !== "deny") {
      logger.error(
        `Invalid state received when denying permission. Expected 'deny' but got '${permission.state}'.`
      )
      return
    }
    if (!permission.accountAddress) {
      logger.error("Empty account address received when denying permission.")
      return
    }

    const { address } = await this.preferenceService.getSelectedAccount()

    // TODO make this multi-network friendly
    await this.db.deletePermission(
      permission.origin,
      address,
      permission.chainID
    )

    if (this.#pendingPermissionsRequests[permission.origin]) {
      this.#pendingPermissionsRequests[permission.origin]("Time to move on")
      delete this.#pendingPermissionsRequests[permission.origin]
    }

    this.notifyContentScriptsAboutAddressChange()
  }

  async denyDAppPermission(permission: PermissionRequest): Promise<void> {
    if (!permission.accountAddress || permission.state !== "deny") {
      logger.error("Invalid state received when denying permission.")
      return
    }

    await this.db.deletePermissionByOriginAndChain(
      permission.origin,
      permission.chainID
    )

    if (this.#pendingPermissionsRequests[permission.origin]) {
      this.#pendingPermissionsRequests[permission.origin]("Time to move on")
      delete this.#pendingPermissionsRequests[permission.origin]
    }

    this.notifyContentScriptsAboutAddressChange()
  }

  async denyDAppPermissionForAddress(
    permission: PermissionRequest,
    address: string
  ): Promise<void> {
    if (!permission.accountAddress || permission.state !== "deny") {
      logger.error("Invalid state received when denying permission.")
      return
    }

    await this.db.deletePermission(
      permission.origin,
      address,
      permission.chainID
    )

    if (this.#pendingPermissionsRequests[permission.origin]) {
      this.#pendingPermissionsRequests[permission.origin]("Time to move on")
      delete this.#pendingPermissionsRequests[permission.origin]
    }

    this.notifyContentScriptsAboutAddressChange()
  }

  async revokePermissionsForAddress(revokeAddress: string): Promise<void> {
    await this.db.deletePermissionByAddress(revokeAddress)
    this.notifyContentScriptsAboutAddressChange()
  }

  async checkPermission(
    origin: string,
    chainID: string
  ): Promise<PermissionRequest | undefined> {
    const { address: selectedAddress } =
      await this.preferenceService.getSelectedAccount()
    // TODO make this multi-network friendly
    return this.db.checkPermission(origin, selectedAddress, chainID)
  }

  async revokePermissionsForChain(chainId: string): Promise<void> {
    await this.db.deletePermissionsByChain(chainId)
  }

  async routeSafeRequest(
    method: string,
    params: unknown[],
    origin: string,
    popupPromise: Promise<browser.Windows.Window>
  ): Promise<unknown> {
    return this.internalQuaiProviderService
      .routeSafeRPCRequest(method, params, origin)
      .finally(async () => {
        const popup = await popupPromise
        if (typeof popup.id !== "undefined") {
          browser.windows.remove(popup.id)
        }
      })
  }

  async routeContentScriptRPCRequest(
    enablingPermission: PermissionRequest,
    method: string,
    rawParams: RPCRequest["params"],
    origin: string
  ): Promise<unknown> {
    const params = parseRPCRequestParams(enablingPermission, method, rawParams)

    try {
      switch (method) {
        case "quai_requestAccounts":
        case "quai_accounts":
          return [enablingPermission.accountAddress]
        case "quai_signTypedData":
        case "quai_signTypedData_v1":
        case "quai_signTypedData_v3":
        case "quai_signTypedData_v4":
          checkPermissionSignTypedData(
            params[0] as HexString,
            enablingPermission
          )

          return await this.routeSafeRequest(
            method,
            params,
            origin,
            showExtensionPopup(AllowedQueryParamPage.signData)
          )
        case "quai_sign":
          checkPermissionSign(params[0] as HexString, enablingPermission)

          return await this.routeSafeRequest(
            method,
            params,
            origin,
            showExtensionPopup(AllowedQueryParamPage.personalSignData)
          )
        case "personal_sign":
          checkPermissionSign(params[1] as HexString, enablingPermission)

          return await this.routeSafeRequest(
            method,
            params,
            origin,
            showExtensionPopup(AllowedQueryParamPage.personalSignData)
          )
        case "quai_signTransaction":
        case "quai_sendTransaction":
          // TODO check this checkPermissionSignTransaction function in future
          checkPermissionSignTransaction(
            (params[0] as QuaiTransactionRequest).chainId,
            (params[0] as QuaiTransactionRequest).from as string,
            enablingPermission
          )

          return await this.routeSafeRequest(
            method,
            params,
            origin,
            showExtensionPopup(AllowedQueryParamPage.signTransaction)
          )

        case "wallet_switchEthereumChain":
          return await this.internalQuaiProviderService.routeSafeRPCRequest(
            method,
            params,
            origin
          )

        case "wallet_addEthereumChain": {
          const id = this.addNetworkRequestId.toString()

          this.addNetworkRequestId += 1

          const window = await showExtensionPopup(
            AllowedQueryParamPage.addNewChain,
            { requestId: id.toString() }
          )

          browser.windows.onRemoved.addListener((removed) => {
            if (removed === window.id) {
              this.handleAddNetworkRequest(id, false)
            }
          })

          const [rawChainData, address, siteTitle, favicon] = params
          const validatedData = validateAddEthereumChainParameter(
            rawChainData as AddEthereumChainParameter
          )

          const userConfirmation = new Promise<void>((resolve, reject) => {
            this.#pendingAddNetworkRequests[id] = {
              resolve,
              reject,
              data: {
                ...validatedData,
                favicon: favicon as string,
                siteTitle: siteTitle as string,
              },
            }
          })

          await userConfirmation

          const account = await this.preferenceService.getSelectedAccount()

          await this.grantPermission({
            ...enablingPermission,
            key: `${origin}_${account.address}_${validatedData.chainId}`,
            chainID: validatedData.chainId,
          })

          return await this.internalQuaiProviderService.routeSafeRPCRequest(
            method,
            [validatedData, address],
            origin
          )
        }
        default: {
          return await this.internalQuaiProviderService.routeSafeRPCRequest(
            method,
            params,
            origin
          )
        }
      }
    } catch (error) {
      logger.error("Error processing request", error)
      return handleRPCErrorResponse(error)
    }
  }

  getNewCustomRPCDetails(requestId: string): AddChainRequestData {
    return this.#pendingAddNetworkRequests[requestId].data
  }

  handleAddNetworkRequest(id: string, success: boolean): void {
    const request = this.#pendingAddNetworkRequests[id]
    if (success) {
      request.resolve()
    } else {
      request.reject()
    }
  }
}
