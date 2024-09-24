import {
  TypedDataEncoder,
  QuaiTransaction,
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
import {
  initializeInternalQuaiDatabase,
  InternalQuaiProviderDatabase,
} from "./db"
import { PELAGUS_INTERNAL_ORIGIN } from "./constants"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { NetworksArray } from "../../constants/networks/networks"
import { normalizeHexAddress } from "../../utils/addresses"
import TransactionService from "../transactions"
import { QuaiTransactionRequestWithAnnotation } from "../transactions/types"

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
      await preferenceService
    )
  }

  private constructor(
    private db: InternalQuaiProviderDatabase,
    private chainService: ChainService,
    private transactionsService: TransactionService,
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
      // quais driven methods
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
        return this.chainService.jsonRpcProvider.getBlockNumber(
          params[0] as Shard
        )
      case "quai_estimateGas":
        return this.chainService.jsonRpcProvider.estimateGas(
          params[0] as TransactionRequest
        )
      case "quai_getTransactionReceipt":
        return this.chainService.jsonRpcProvider.getTransactionReceipt(
          params[0] as string
        )
      case "quai_getTransactionByHash":
        return this.chainService.jsonRpcProvider.getTransaction(
          params[0] as string
        )
      case "quai_getTransactionCount":
        return this.chainService.jsonRpcProvider.getTransactionCount(
          getAddress(params[0] as string),
          params[1] as quais.BlockTag
        )
      case "quai_accounts": {
        const { address } = await this.preferenceService.getSelectedAccount()
        return [address]
      }
      case "quai_sendTransaction":
        return this.signTransaction(
          params[0] as QuaiTransactionRequestWithAnnotation,
          origin
        ).then(async (tx) => {
          return tx.hash
        })
      case "quai_signTransaction":
        return this.signTransaction(
          params[0] as QuaiTransactionRequestWithAnnotation,
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
      case "quai_getBlockByHash":
      case "quai_getBlockByNumber":
        return this.chainService.jsonRpcProvider.getBlock(
          params[0] as Shard,
          params[1] as BlockTag
        )
      case "quai_getBalance":
        return this.chainService.jsonRpcProvider.getBalance(
          params[0] as AddressLike
        )

      case "quai_nodeLocation":
        return this.chainService.jsonRpcProvider.getRunningLocations()
      case "quai_getLogs":
      case "quai_getFilterLogs":
        return this.chainService.jsonRpcProvider.getLogs(
          params[0] as Filter | FilterByBlockHash
        )
      case "quai_call":
        return this.chainService.jsonRpcProvider.call(
          params[0] as QuaiTransactionRequest
        )
      case "quai_getCode":
        return this.chainService.jsonRpcProvider.getCode(
          params[0] as AddressLike
        )
      case "quai_getStorageAt":
        return this.chainService.jsonRpcProvider.getStorage(
          params[0] as AddressLike,
          params[1] as BigNumberish
        )
      case "quai_sendRawTransaction":
        return this.chainService.jsonRpcProvider.broadcastTransaction(
          params[0] as Zone,
          params[1] as string
        )

      // just "proxying" requests to quais
      case "quai_gasPrice":
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
      case "quai_maxPriorityFeePerGas":
      case "quai_newBlockFilter":
      case "quai_newFilter":
      case "quai_newPendingTransactionFilter":
      case "quai_protocolVersion":
      case "quai_subscribe":
      case "quai_syncing":
      case "quai_uninstallFilter":
      case "quai_unsubscribe":
      case "net_listening":
      case "net_version":
      case "web3_clientVersion":
      case "web3_sha3":
        return this.transactionsService.send(method, params)

      // not supported methods
      case "wallet_requestPermissions":
      case "estimateGas":
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
    transactionRequest: QuaiTransactionRequestWithAnnotation,
    origin: string
  ): Promise<QuaiTransaction> {
    const annotation =
      origin === PELAGUS_INTERNAL_ORIGIN &&
      "annotation" in transactionRequest &&
      transactionRequest.annotation !== undefined
        ? transactionRequest.annotation
        : undefined

    if (!transactionRequest.from) {
      throw new Error("Transactions must have a from address for signing.")
    }

    const { store, chainService } = globalThis.main

    const currentNetwork = store.getState().ui.selectedAccount.network

    const to = transactionRequest.to
      ? getAddress(transactionRequest.to.toString())
      : null
    const from = getAddress(transactionRequest.from.toString())
    const nonce = await chainService.jsonRpcProvider.getTransactionCount(from)

    await globalThis.main.blockService.pollBlockPricesForNetwork({
      network: currentNetwork,
    })
    await globalThis.main.blockService.pollLatestBlock(currentNetwork)

    return new Promise<QuaiTransaction>((resolve, reject) => {
      this.emitter.emit("transactionSignatureRequest", {
        payload: {
          to,
          data: transactionRequest.data,
          from,
          type: transactionRequest.type,
          value: transactionRequest.value,
          chainId: currentNetwork.chainID,
          gasLimit: transactionRequest.gasLimit,
          network: currentNetwork,
          nonce,
          annotation,
        },
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
