import {
  TypedDataEncoder,
  QuaiTransaction,
  hexlify,
  toUtf8Bytes,
  AddressLike,
} from "quais"
import {
  EIP1193_ERROR_CODES,
  EIP1193Error,
  RPCRequest,
} from "@pelagus-provider/provider-bridge-shared"
import { QuaiTransactionRequest } from "quais/lib/commonjs/providers"
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
import { getOrCreateDB, InternalQuaiProviderDatabase } from "./db"
import { PELAGUS_INTERNAL_ORIGIN } from "./constants"
import { TransactionAnnotation } from "../enrichment"
import type { ValidatedAddEthereumChainParameter } from "../provider-bridge/utils"
import { decodeJSON } from "../../lib/utils"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { NetworksArray } from "../../constants/networks/networks"
import { QuaiTransactionRequestWithAnnotation } from "../chain/types"
import { normalizeHexAddress } from "../../utils/addresses"

// A type representing the transaction requests that come in over JSON-RPC
// requests like eth_sendTransaction and eth_signTransaction. These are very
// similar in structure to the Ethers internal TransactionRequest object, but
// have some subtle-yet-critical differences. Chief among these is the presence
// of `gas` instead of `gasLimit` and the _possibility_ of using `input` instead
// of `data`.
//
// Note that `input` is the newer and more correct field to expect contract call
// data in, but older clients may provide `data` instead. Ethers transmits `data`
// rather than `input` when used as a JSON-RPC client, and expects it as the
// `EthersTransactionRequest` field for that info.
//
// Additionally, internal provider requests can include an explicit
// JSON-serialized annotation field provided by the wallet. The internal
// provider disallows this field from non-internal sources.
type JsonRpcTransactionRequest = Omit<QuaiTransactionRequest, "gasLimit"> & {
  gas?: string
  input?: string
  annotation?: string
}

// https://eips.ethereum.org/EIPS/eip-3326
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
    QuaiTransaction
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
    [Promise<ChainService>, Promise<PreferenceService>]
  > = async (chainService, preferenceService) => {
    return new this(
      await getOrCreateDB(),
      await chainService,
      await preferenceService
    )
  }

  private constructor(
    private db: InternalQuaiProviderDatabase,
    private chainService: ChainService,
    private preferenceService: PreferenceService
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
      } catch (error) {
        logger.debug("error processing request", event.id, error)

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
      case "quai_signTypedData":
      case "quai_signTypedData_v1":
      case "quai_signTypedData_v3":
      case "quai_signTypedData_v4":
        return this.signTypedData({
          account: {
            address: params[0] as string,
            network: await this.getCurrentOrDefaultNetworkForOrigin(origin),
          },
          typedData: JSON.parse(params[1] as string),
        })
      case "quai_chainId":
        // TODO Decide on a better way to track whether a particular chain is
        // allowed to have an RPC call made to it. Ideally this would be based
        // on a user's idea of a dApp connection rather than a network-specific
        // modality, requiring it to be constantly "switched"
        return toHexChainID(
          (await this.getCurrentOrDefaultNetworkForOrigin(origin)).chainID
        )
      case "quai_blockNumber":
      case "quai_call":
      case "quai_estimateGas":
      case "quai_feeHistory":
      case "quai_gasPrice":
      case "quai_getBalance":
      case "quai_getBlockByHash":
      case "quai_getBlockByNumber":
      case "quai_getBlockTransactionCountByHash":
      case "quai_getBlockTransactionCountByNumber":
      case "quai_getCode":
      case "quai_getFilterChanges":
      case "quai_getFilterLogs":
      case "quai_getLogs":
      case "quai_getProof":
      case "quai_getStorageAt":
      case "quai_getTransactionByBlockHashAndIndex":
      case "quai_getTransactionByBlockNumberAndIndex":
      case "quai_getTransactionByHash":
      case "quai_getTransactionCount":
      case "quai_getTransactionReceipt":
      case "quai_getUncleByBlockHashAndIndex":
      case "quai_getUncleByBlockNumberAndIndex":
      case "quai_getUncleCountByBlockHash":
      case "quai_getUncleCountByBlockNumber":
      case "quai_maxPriorityFeePerGas":
      case "quai_newBlockFilter":
      case "quai_newFilter":
      case "quai_newPendingTransactionFilter":
      case "quai_nodeLocation":
      case "quai_protocolVersion":
      case "quai_sendRawTransaction":
      case "quai_subscribe":
      case "quai_syncing":
      case "quai_uninstallFilter":
      case "quai_unsubscribe":
      case "net_listening":
      case "net_version":
      case "web3_clientVersion":
      case "web3_sha3":
        return this.chainService.send(method, params)
      case "quai_accounts": {
        const { address } = await this.preferenceService.getSelectedAccount()
        return [address]
      }
      case "quai_sendTransaction":
        return this.signTransaction(
          {
            ...(params[0] as JsonRpcTransactionRequest),
          },
          origin
        ).then(async (signed) => {
          // await this.chainService.broadcastSignedTransaction(signed) // TODO-MIGRATION
          return signed.hash
        })
      case "quai_signTransaction":
        return this.signTransaction(
          params[0] as JsonRpcTransactionRequest,
          origin
        ).then(
          (signedTransaction) =>
            // TODO-MIGRATION: check how to sign a transaction in new SDK (which data and type return)
            //  Previously was using unsigned tx + signature in "serialize" func
            //  serialize(
            //  ethersTransactionFromSignedTransaction(signedTransaction),
            //  {
            //  r: signedTransaction.r,
            //  s: signedTransaction.s,
            //  v: signedTransaction.v,
            //  }
            //  )
            QuaiTransaction.from(signedTransaction)
          // ----------------------------------------------
        )
      case "quai_sign":
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
      // will just switch to a chain if we already support it - but not add a new one
      case "wallet_addEthereumChain": {
        const chainInfo = params[0] as ValidatedAddEthereumChainParameter
        const { chainId } = chainInfo
        const supportedNetwork = NetworksArray.find(
          (network) => network.chainID === chainId
        )
        if (supportedNetwork) {
          await this.switchToSupportedNetwork(origin, supportedNetwork)
          this.emitter.emit("selectedNetwork", supportedNetwork)
          return null
        }
      }
      case "wallet_switchEthereumChain": {
        const newChainId = (params[0] as SwitchEthereumChainParameter).chainId
        const supportedNetwork = NetworksArray.find(
          (network) => network.chainID === newChainId
        )
        if (supportedNetwork) {
          this.switchToSupportedNetwork(origin, supportedNetwork)
          return null
        }

        throw new EIP1193Error(EIP1193_ERROR_CODES.chainDisconnected)
      }
      case "wallet_watchAsset": {
        const { type, options } = params[0]
          ? (params[0] as WatchAssetParameters)
          : // some dapps send the object directly instead of an array
            (params as unknown as WatchAssetParameters)
        if (type !== "ERC20") {
          throw new EIP1193Error(EIP1193_ERROR_CODES.unsupportedMethod)
        }

        if (options.chainId) {
          const supportedNetwork = NetworksArray.find(
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
      case "wallet_requestPermissions":
      case "estimateGas": // --- eip1193-bridge only method --
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

  private async signTransaction(
    transactionRequest: JsonRpcTransactionRequest,
    origin: string
  ): Promise<QuaiTransaction> {
    const annotation =
      origin === PELAGUS_INTERNAL_ORIGIN &&
      "annotation" in transactionRequest &&
      transactionRequest.annotation !== undefined
        ? // We use  `as` here as we know it's from a trusted source.
          (decodeJSON(transactionRequest.annotation) as TransactionAnnotation)
        : undefined

    if (!transactionRequest.from) {
      throw new Error("Transactions must have a from address for signing.")
    }

    const currentNetwork =
      globalThis.main.store.getState().ui.selectedAccount.network

    return new Promise<QuaiTransaction>((resolve, reject) => {
      this.emitter.emit("transactionSignatureRequest", {
        payload: {
          to: transactionRequest.to,
          data: transactionRequest.input,
          from: transactionRequest.from,
          type: transactionRequest.type,
          value: transactionRequest.value,
          chainId: transactionRequest.chainId,
          gasLimit: transactionRequest.gas,
          maxFeePerGas: transactionRequest.maxFeePerGas,
          maxPriorityFeePerGas: transactionRequest.maxPriorityFeePerGas,
          network: currentNetwork,
          annotation,
        },
        resolver: resolve,
        rejecter: reject,
      })
    })
  }

  private async signTypedData(params: SignTypedDataRequest) {
    // Ethers does not want to see the EIP712Domain field, extract it.
    const { EIP712Domain, ...typesForSigning } = params.typedData.types

    // Ask Ethers to give us a filtered payload that only includes types
    // specified in the `types` object.
    const filteredTypedDataPayload = TypedDataEncoder.getPayload(
      params.typedData.domain,
      typesForSigning,
      params.typedData.message
    )

    const filteredRequest = {
      ...params,
      typedData: {
        ...filteredTypedDataPayload,
        types: {
          // If there was an EIP712Domain field in the `types`, pass it along.
          ...(EIP712Domain === undefined ? {} : { EIP712Domain }),
          ...filteredTypedDataPayload.types,
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
    const { address } = await this.preferenceService.getSelectedAccount()
    await this.chainService.markAccountActivity({
      address,
      network: supportedNetwork,
    })
    await this.db.setCurrentChainIdForOrigin(origin, supportedNetwork)
  }

  private async signData(
    {
      input,
      account,
    }: {
      input: string
      account: string
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
          rawSigningData: hexInput,
          ...typeAndData,
        },
        resolver: resolve,
        rejecter: reject,
      })
    })
  }
}
