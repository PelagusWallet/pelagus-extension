import {
  TypedDataEncoder,
  hexlify,
  toUtf8Bytes,
  AddressLike,
  TransactionRequest,
  quais,
  Shard,
  getAddress,
  BlockTag,
  Filter,
  FilterByBlockHash,
  BigNumberish,
  Zone,
} from "quais"
import {
  Filter as EthFilter,
  FilterByBlockHash as EthFilterByBlockHash,
  TransactionRequest as EthTransactionRequest,
} from "ethers"
import {
  EIP1193_ERROR_CODES,
  EIP1193Error,
  RPCRequest,
} from "@pelagus-provider/provider-bridge-shared"
import {
  QuaiTransactionRequest,
  QuaiTransactionResponse,
} from "quais/lib/commonjs/providers"
import logger from "../../lib/logger"
import BaseService from "../base"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import ChainService from "../chain"
import { toHexChainID } from "../../networks"
import PreferenceService from "../preferences"
import { internalProviderPort } from "../../redux-slices/utils/contract-utils"
import {
  MessageSigningRequest,
  parseSigningData,
  SignTypedDataRequest,
} from "../../utils/signing"
import {
  initializeInternalQuaiDatabase,
  InternalQuaiProviderDatabase,
} from "./db"
import { PELAGUS_INTERNAL_ORIGIN } from "./constants"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { PELAGUS_NETWORKS } from "../../constants/networks/networks"
import { normalizeHexAddress } from "../../utils/addresses"
import TransactionService from "../transactions"
import { QuaiTransactionRequestWithAnnotation } from "../transactions/types"
import { ValidatedAddEthereumChainParameter } from "../provider-bridge/utils"
import { ProviderBridgeDatabase } from "../provider-bridge/db"

export type SwitchEthereumChainParameter = {
  chainId: string
}

// https://eips.ethereum.org/EIPS/eip-747
type WatchAssetParameters = {
  type: string // The asset's interface, e.g. 'ERC1046'
  options: WatchAssetOptions
}

type WatchAssetOptions = {
  address: string // The hexadecimal address of the token contract
  chainId?: number // The chain ID of the asset. If empty, defaults to the current chain ID.
  // Fields such as symbol and name can be present here as well - but lets just fetch them from the contract
}

// https://eips.ethereum.org/EIPS/eip-3085
export type AddEthereumChainParameter = {
  chainId: string
  blockExplorerUrls?: string[]
  chainName?: string
  iconUrls?: string[]
  nativeCurrency?: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls?: string[]
}

type DAppRequestEvent<T, E> = {
  payload: T
  resolver: (result: E | PromiseLike<E>) => void
  rejecter: () => void
}

type Events = ServiceLifecycleEvents & {
  transactionSignatureRequest: DAppRequestEvent<
    Partial<QuaiTransactionRequestWithAnnotation> & {
      from: AddressLike
      network: NetworkInterface
    },
    QuaiTransactionResponse
  >
  transactionSendRequest: DAppRequestEvent<
    QuaiTransactionRequestWithAnnotation,
    QuaiTransactionResponse
  >
  signTypedDataRequest: DAppRequestEvent<SignTypedDataRequest, string>
  signDataRequest: DAppRequestEvent<MessageSigningRequest, string>
  selectedNetwork: NetworkInterface
  watchAssetRequest: { contractAddress: string; network: NetworkInterface }
}

export default class InternalQuaiProviderService extends BaseService<Events> {
  static create: ServiceCreatorFunction<
    Events,
    InternalQuaiProviderService,
    [
      Promise<ChainService>,
      Promise<TransactionService>,
      Promise<PreferenceService>
    ]
  > = async (chainService, transactionService, preferenceService) => {
    return new this(
      await initializeInternalQuaiDatabase(),
      await chainService,
      await transactionService,
      await preferenceService,
      new ProviderBridgeDatabase()
    )
  }

  private constructor(
    private db: InternalQuaiProviderDatabase,
    private chainService: ChainService,
    private transactionsService: TransactionService,
    private preferenceService: PreferenceService,
    private providerBridgeDb: ProviderBridgeDatabase
  ) {
    super()

    internalProviderPort.emitter.on("message", async (event) => {
      logger.debug(`internal: request payload: ${JSON.stringify(event)}`)
      try {
        const response = {
          id: event.id,
          result: await this.routeSafeRPCRequest(
            event.request.method,
            event.request.params,
            PELAGUS_INTERNAL_ORIGIN
          ),
        }
        logger.debug("internal response:", response)

        internalProviderPort.postResponse(response)
      } catch (error: any) {
        logger.debug(`Error processing request: ${event.id}`, error.message)

        internalProviderPort.postResponse({
          id: event.id,
          result: new EIP1193Error(
            EIP1193_ERROR_CODES.userRejectedRequest
          ).toJSON(),
        })
      }
    })
  }

  async routeSafeRPCRequest(
    method: string,
    params: RPCRequest["params"],
    origin: string
  ): Promise<unknown> {
    switch (method) {
      case "quai_accounts":
      case "eth_accounts": {
        const { address } = await this.preferenceService.getSelectedAccount()
        return [address]
      }

      case "quai_getBalance":
      case "eth_getBalance":
        return this.chainService.jsonRpcProvider.getBalance(
          params[0] as AddressLike
        )

      // supported methods
      case "quai_signTypedData":
      case "quai_signTypedData_v1":
      case "quai_signTypedData_v3":
      case "quai_signTypedData_v4":
      case "eth_signTypedData":
      case "eth_signTypedData_v1":
      case "eth_signTypedData_v3":
      case "eth_signTypedData_v4":
        return this.signTypedData({
          account: {
            address: params[0] as string,
            network: await this.getCurrentOrDefaultNetworkForOrigin(origin),
          },
          typedData: JSON.parse(params[1] as string),
        })

      case "quai_sign":
      case "eth_sign":
        return this.signData(
          {
            input: params[1] as string,
            account: params[0] as string,
          },
          origin
        )

      case "personal_sign":
        return this.signData(
          {
            input: params[0] as string,
            account: params[1] as string,
          },
          origin
        )

      case "qi_signAll":
        return this.signData(
          {
            input: params[0] as string,
            account: params[1] as string,
            coin: "qi",
          },
          origin
        )

      case "quai_blockNumber":
      case "eth_blockNumber":
        if (!params[0]) {
          return this.chainService.jsonRpcProvider.getBlockNumber(
            "0x00" as Shard
          )
        } else {
          return this.chainService.jsonRpcProvider.getBlockNumber(
            params[0] as Shard
          )
        }

      case "quai_getBlockByHash":
      case "quai_getBlockByNumber":
        return this.chainService.jsonRpcProvider.getBlock(
          params[0] as Shard,
          params[1] as BlockTag,
          params[2] as boolean
        )

      case "eth_getBlockByHash":
      case "eth_getBlockByNumber":
        return this.chainService.ethJsonRpcProvider.getBlock(
          params[0] as BlockTag,
          params[1] as boolean
        )

      case "quai_getTransactionReceipt":
        return this.chainService.jsonRpcProvider.getTransactionReceipt(
          params[0] as string
        )
      case "eth_getTransactionReceipt":
        return this.chainService.ethJsonRpcProvider.getTransactionReceipt(
          params[0] as string
        )

      case "quai_getTransactionByHash":
        return this.chainService.jsonRpcProvider.getTransaction(
          params[0] as string
        )
      case "eth_getTransactionByHash":
        return this.chainService.ethJsonRpcProvider.getTransaction(
          params[0] as string
        )

      case "quai_getTransactionCount":
      case "eth_getTransactionCount":
        return this.chainService.jsonRpcProvider.getTransactionCount(
          getAddress(params[0] as string),
          params[1] as quais.BlockTag
        )

      case "quai_estimateGas":
        return this.chainService.jsonRpcProvider
          .estimateGas(params[0] as TransactionRequest)
          .then((estimatedGas) => estimatedGas.toString())
      case "eth_estimateGas":
        return this.chainService.ethJsonRpcProvider
          .estimateGas(params[0] as EthTransactionRequest)
          .then((estimatedGas) => estimatedGas.toString())

      case "quai_createAccessList":
        return this.chainService.jsonRpcProvider.createAccessList(
          params[0] as TransactionRequest
        )

      case "quai_sendTransaction":
      case "eth_sendTransaction":
        const request = params[0] as QuaiTransactionRequestWithAnnotation & {
          maxFeePerGas?: string
          maxPriorityFeePerGas?: string
        }
        return this.sendTransaction(request, origin).then(
          (transactionResponse) => transactionResponse.hash
        )

      case "quai_sendRawTransaction":
        return this.chainService.jsonRpcProvider.broadcastTransaction(
          params[0] as Zone,
          params[1] as string
        )
      case "eth_sendRawTransaction":
        throw new Error(
          "eth_sendRawTransaction is not supported. You must use quai_sendRawTransaction instead."
        )

      case "quai_gasPrice":
      case "eth_gasPrice":
        return this.chainService.jsonRpcProvider
          .getFeeData()
          .then((feeData) => feeData.gasPrice)

      case "quai_call":
      case "eth_call":
        return this.chainService.jsonRpcProvider.call(
          params[0] as QuaiTransactionRequest
        )

      case "quai_getLogs":
      case "quai_getFilterLogs":
        return this.chainService.jsonRpcProvider.getLogs(
          params[0] as Filter | FilterByBlockHash
        )
      case "eth_getLogs":
      case "eth_getFilterLogs":
        return this.chainService.ethJsonRpcProvider.getLogs(
          params[0] as EthFilter | EthFilterByBlockHash
        )

      case "quai_getCode":
      case "eth_getCode":
        return this.chainService.jsonRpcProvider.getCode(
          params[0] as AddressLike
        )

      case "quai_getStorageAt":
      case "eth_getStorageAt":
        return this.chainService.jsonRpcProvider.getStorage(
          params[0] as AddressLike,
          params[1] as BigNumberish
        )

      case "quai_chainId":
      case "eth_chainId":
        // TODO Decide on a better way to track whether a particular chain is
        // allowed to have an RPC call made to it. Ideally this would be based
        // on a user's idea of a dApp connection rather than a network-specific
        // modality, requiring it to be constantly "switched"
        return toHexChainID(
          (await this.getCurrentOrDefaultNetworkForOrigin(origin)).chainID
        )

      case "quai_nodeLocation":
        return this.chainService.jsonRpcProvider.getRunningLocations()

      case "wallet_watchAsset": {
        const { type, options } = params[0]
          ? (params[0] as WatchAssetParameters)
          : // some dapps send the object directly instead of an array
            (params as unknown as WatchAssetParameters)
        if (type !== "ERC20") {
          throw new EIP1193Error(EIP1193_ERROR_CODES.unsupportedMethod)
        }

        if (options.chainId) {
          const supportedNetwork = PELAGUS_NETWORKS.find(
            (network) => network.chainID === String(options.chainId)
          )
          if (!supportedNetwork) {
            throw new EIP1193Error(EIP1193_ERROR_CODES.userRejectedRequest)
          }
          this.emitter.emit("watchAssetRequest", {
            contractAddress: normalizeHexAddress(options.address),
            network: supportedNetwork,
          })
          return true
        }

        // if chainID is not specified, we assume the current network - as per EIP-747
        const network = await this.getCurrentOrDefaultNetworkForOrigin(origin)

        this.emitter.emit("watchAssetRequest", {
          contractAddress: normalizeHexAddress(options.address),
          network,
        })
        return true
      }
      // will just switch to a chain if we already support it - but not add a new one
      case "wallet_addEthereumChain": {
        const chainInfo = params[0] as ValidatedAddEthereumChainParameter
        const { chainId } = chainInfo
        const supportedNetwork = PELAGUS_NETWORKS.find(
          (network) => network.chainID === chainId
        )
        if (supportedNetwork) {
          await this.switchToSupportedNetwork(origin, supportedNetwork)
          this.emitter.emit("selectedNetwork", supportedNetwork)
          return null
        }
        break
      }
      case "wallet_switchEthereumChain": {
        const newChainId = (params[0] as SwitchEthereumChainParameter).chainId
        const supportedNetwork = PELAGUS_NETWORKS.find(
          (network) => network.chainID === newChainId
        )
        if (supportedNetwork) {
          this.switchToSupportedNetwork(origin, supportedNetwork)
          return null
        }

        throw new EIP1193Error(EIP1193_ERROR_CODES.chainDisconnected)
      }

      // just "proxying" requests to quais
      case "quai_feeHistory":
      case "quai_getBlockTransactionCountByHash":
      case "quai_getBlockTransactionCountByNumber":
      case "quai_getFilterChanges":
      case "quai_getProof":
      case "quai_getTransactionByBlockHashAndIndex":
      case "quai_getTransactionByBlockNumberAndIndex":
      case "quai_getUncleByBlockHashAndIndex":
      case "quai_getUncleByBlockNumberAndIndex":
      case "quai_getUncleCountByBlockHash":
      case "quai_getUncleCountByBlockNumber":
      case "quai_newBlockFilter":
      case "quai_newFilter":
      case "quai_newPendingTransactionFilter":
      case "quai_protocolVersion":
      case "quai_subscribe":
      case "quai_uninstallFilter":
      case "quai_unsubscribe":
      case "net_listening":
      case "net_version":
      case "web3_clientVersion":
      case "web3_sha3":
        return this.transactionsService.send(method, params)

      // unsupported methods

      case "wallet_requestPermissions":
      case "wallet_getPermissions": {
        const { address } = await this.preferenceService.getSelectedAccount()
        const network = await this.getCurrentOrDefaultNetworkForOrigin(origin)

        const permission = await this.providerBridgeDb.checkPermission(
          origin,
          address,
          network.chainID
        )

        if (!permission) {
          return []
        }

        // Format according to EIP-2255
        return [
          {
            invoker: origin,
            parentCapability: "eth_accounts",
            caveats: [],
          },
        ]
      }
      case "net_peerCount":
      case "wallet_accountsChanged":
      case "wallet_registerOnboarding":
      default:
        throw new EIP1193Error(EIP1193_ERROR_CODES.unsupportedMethod)
    }
  }

  private async getCurrentInternalNetwork(): Promise<NetworkInterface> {
    return this.db.getCurrentNetworkForOrigin(
      PELAGUS_INTERNAL_ORIGIN
    ) as Promise<NetworkInterface>
  }

  async getCurrentOrDefaultNetworkForOrigin(
    origin: string
  ): Promise<NetworkInterface> {
    const currentNetwork = await this.db.getCurrentNetworkForOrigin(origin)
    if (!currentNetwork) {
      // If this is a new dapp or the dapp has not implemented wallet_switchEthereumChain
      // use the default network.
      return this.getCurrentInternalNetwork()
    }
    return currentNetwork
  }

  async removePrefererencesForChain(chainId: string): Promise<void> {
    await this.db.removeStoredPreferencesForChain(chainId)
  }

  private async sendTransaction(
    transactionRequest: QuaiTransactionRequestWithAnnotation & {
      gas?: string
      maxFeePerGas?: string
      maxPriorityFeePerGas?: string
    },
    origin: string
  ): Promise<QuaiTransactionResponse> {
    const annotation =
      origin === PELAGUS_INTERNAL_ORIGIN &&
      "annotation" in transactionRequest &&
      transactionRequest.annotation !== undefined
        ? transactionRequest.annotation
        : undefined

    if (!transactionRequest.from) {
      throw new Error("Transactions must have a from address for signing.")
    }

    const to = transactionRequest.to
      ? getAddress(String(transactionRequest.to))
      : null
    const from = getAddress(String(transactionRequest.from))

    const { store, blockService } = globalThis.main
    const { network } = store.getState().ui.selectedAccount

    await blockService.pollBlockPricesForNetwork({ network })
    await blockService.pollLatestBlock(network)

    const payload: QuaiTransactionRequestWithAnnotation & {
      gas?: string
      maxFeePerGas?: string
      maxPriorityFeePerGas?: string
    } = {
      to,
      from,
      type: transactionRequest.type || 2,
      chainId: network.chainID,
      data: transactionRequest.data,
      value: transactionRequest.value,
      network,
      annotation,
    }

    // Quai specific fields
    if ("gasLimit" in transactionRequest) {
      payload.gasLimit = transactionRequest.gasLimit
    }

    if ("gasPrice" in transactionRequest) {
      payload.gasPrice = transactionRequest.gasPrice
    }

    // // Ethereum specific fields
    if ("gas" in transactionRequest) {
      payload.gasLimit = transactionRequest.gas
    }

    if ("maxFeePerGas" in transactionRequest) {
      payload.gasPrice = transactionRequest.maxFeePerGas
    }

    if (typeof transactionRequest.value === "undefined") {
      delete payload.value
    }

    return new Promise<QuaiTransactionResponse>((resolve, reject) => {
      this.emitter.emit("transactionSendRequest", {
        payload,
        resolver: resolve,
        rejecter: reject,
      })
    })
  }

  private async signTypedData(params: SignTypedDataRequest) {
    const { EIP712Domain: _, ...typesForSigning } = params.typedData.types

    const filteredTypedDataPayload = TypedDataEncoder.getPayload(
      params.typedData.domain,
      typesForSigning,
      params.typedData.message
    )

    // We do not want to see the EIP712Domain field, extract it.
    const { EIP712Domain, ...filteredTypes } = filteredTypedDataPayload.types

    const filteredRequest = {
      ...params,
      typedData: {
        ...filteredTypedDataPayload,
        types: {
          ...filteredTypes,
        },
      },
    }

    return new Promise<string>((resolve, reject) => {
      this.emitter.emit("signTypedDataRequest", {
        payload: filteredRequest,
        resolver: resolve,
        rejecter: reject,
      })
    })
  }

  async switchToSupportedNetwork(
    origin: string,
    supportedNetwork: NetworkInterface
  ): Promise<void> {
    await this.db.setCurrentChainIdForOrigin(origin, supportedNetwork)
  }

  private async signData(
    {
      input,
      account,
      coin,
    }: {
      input: string
      account: string
      coin?: "quai" | "qi"
    },
    origin: string
  ) {
    const hexInput = input.match(/^0x[0-9A-Fa-f]*$/)
      ? input
      : hexlify(toUtf8Bytes(input))
    const typeAndData = parseSigningData(input)
    const currentNetwork = await this.getCurrentOrDefaultNetworkForOrigin(
      origin
    )

    return new Promise<string>((resolve, reject) => {
      this.emitter.emit("signDataRequest", {
        payload: {
          account: {
            address: account,
            network: currentNetwork,
          },
          coin: coin || "quai",
          rawSigningData: hexInput,
          ...typeAndData,
        },
        resolver: resolve,
        rejecter: reject,
      })
    })
  }
}
