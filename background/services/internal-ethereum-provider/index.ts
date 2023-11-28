import { TransactionRequest as EthersTransactionRequest } from "@quais/abstract-provider"
import { serialize as serializeEthersTransaction } from "@quais/transactions"

import {
  EIP1193Error,
  EIP1193_ERROR_CODES,
  RPCRequest,
} from "@tallyho/provider-bridge-shared"
import { hexlify, toUtf8Bytes, _TypedDataEncoder } from "ethers/lib/utils"
import { normalizeHexAddress } from "@pelagus/hd-keyring"

import logger from "../../lib/logger"

import BaseService from "../base"
import { ServiceCreatorFunction, ServiceLifecycleEvents } from "../types"
import ChainService from "../chain"
import {
  EVMNetwork,
  sameChainID,
  SignedTransaction,
  toHexChainID,
} from "../../networks"
import {
  ethersTransactionFromSignedTransaction,
  transactionRequestFromEthersTransactionRequest,
} from "../chain/utils"
import PreferenceService from "../preferences"
import { internalProviderPort } from "../../redux-slices/utils/contract-utils"

import {
  SignTypedDataRequest,
  MessageSigningRequest,
  parseSigningData,
} from "../../utils/signing"
import { getOrCreateDB, InternalEthereumProviderDatabase } from "./db"
import { TALLY_INTERNAL_ORIGIN } from "./constants"
import { QUAI_NETWORK, ROOTSTOCK } from "../../constants"
import {
  EnrichedEVMTransactionRequest,
  TransactionAnnotation,
} from "../enrichment"
import type { ValidatedAddEthereumChainParameter } from "../provider-bridge/utils"
import {
  isValidChecksumAddress,
  isMixedCaseAddress,
  decodeJSON,
} from "../../lib/utils"

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
type JsonRpcTransactionRequest = Omit<EthersTransactionRequest, "gasLimit"> & {
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
    Partial<EnrichedEVMTransactionRequest> & {
      from: string
      network: EVMNetwork
    },
    SignedTransaction
  >
  signTypedDataRequest: DAppRequestEvent<SignTypedDataRequest, string>
  signDataRequest: DAppRequestEvent<MessageSigningRequest, string>
  selectedNetwork: EVMNetwork
  watchAssetRequest: { contractAddress: string; network: EVMNetwork }
  // connect
  // disconnet
  // account change
  // networkchange
}

export default class InternalEthereumProviderService extends BaseService<Events> {
  static create: ServiceCreatorFunction<
    Events,
    InternalEthereumProviderService,
    [Promise<ChainService>, Promise<PreferenceService>]
  > = async (chainService, preferenceService) => {
    return new this(
      await getOrCreateDB(),
      await chainService,
      await preferenceService
    )
  }

  private constructor(
    private db: InternalEthereumProviderDatabase,
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
            TALLY_INTERNAL_ORIGIN
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
      // supported alchemy methods: https://docs.alchemy.com/alchemy/apis/ethereum
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
      case "eth_chainId":
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
        return this.chainService.send(
          method,
          params,
          await this.getCurrentOrDefaultNetworkForOrigin(origin)
        )
      case "quai_accounts": {
        // This is a special method, because Alchemy provider DO support it, but always return null (because they do not store keys.)
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
          await this.chainService.broadcastSignedTransaction(signed)
          return signed.hash
        })
      case "quai_signTransaction":
        return this.signTransaction(
          params[0] as JsonRpcTransactionRequest,
          origin
        ).then((signedTransaction) =>
          serializeEthersTransaction(
            ethersTransactionFromSignedTransaction(signedTransaction),
            {
              r: signedTransaction.r,
              s: signedTransaction.s,
              v: signedTransaction.v,
            }
          )
        )
      case "quai_sign": // --- important wallet methods ---
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
      // TODO - actually allow adding a new ethereum chain - for now wallet_addEthereumChain
      // will just switch to a chain if we already support it - but not add a new one
      case "wallet_addEthereumChain": {
        const chainInfo = params[0] as ValidatedAddEthereumChainParameter
        const { chainId } = chainInfo
        const supportedNetwork = await this.getTrackedNetworkByChainId(chainId)
        if (supportedNetwork) {
          await this.switchToSupportedNetwork(origin, supportedNetwork)
          this.emitter.emit("selectedNetwork", supportedNetwork)
          return null
        }
        try {
          const customNetwork = await this.chainService.addCustomChain(
            chainInfo
          )
          this.emitter.emit("selectedNetwork", customNetwork)
          return null
        } catch (e) {
          logger.error(e)
          throw new EIP1193Error(EIP1193_ERROR_CODES.userRejectedRequest)
        }
      }
      case "wallet_switchEthereumChain": {
        const newChainId = (params[0] as SwitchEthereumChainParameter).chainId
        const supportedNetwork = await this.getTrackedNetworkByChainId(
          newChainId
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
          const supportedNetwork = await this.getTrackedNetworkByChainId(
            String(options.chainId)
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
      case "metamask_getProviderState": // --- important MM only methods ---
      case "metamask_sendDomainMetadata":
      case "wallet_requestPermissions":
      case "estimateGas": // --- eip1193-bridge only method --
      case "eth_coinbase": // --- MM only methods ---
      case "eth_decrypt":
      case "eth_getEncryptionPublicKey":
      case "eth_getWork":
      case "eth_hashrate":
      case "eth_mining":
      case "eth_submitHashrate":
      case "eth_submitWork":
      case "metamask_accountsChanged":
      case "metamask_chainChanged":
      case "metamask_logWeb3ShimUsage":
      case "metamask_unlockStateChanged":
      case "metamask_watchAsset":
      case "net_peerCount":
      case "wallet_accountsChanged":
      case "wallet_registerOnboarding":
      default:
        throw new EIP1193Error(EIP1193_ERROR_CODES.unsupportedMethod)
    }
  }

  private async getCurrentInternalNetwork(): Promise<EVMNetwork> {
    return this.db.getCurrentNetworkForOrigin(
      TALLY_INTERNAL_ORIGIN
    ) as Promise<EVMNetwork>
  }

  async getCurrentOrDefaultNetworkForOrigin(
    origin: string
  ): Promise<EVMNetwork> {
    const currentNetwork = await this.db.getCurrentNetworkForOrigin(origin)
    if (!currentNetwork) {
      // If this is a new dapp or the dapp has not implemented wallet_switchEthereumChain
      // use the default network.
      const defaultNetwork = await this.getCurrentInternalNetwork()
      return defaultNetwork
    }
    return currentNetwork
    //return QUAI_NETWORK
  }

  async removePrefererencesForChain(chainId: string): Promise<void> {
    await this.db.removeStoredPreferencesForChain(chainId)
  }

  private async signTransaction(
    transactionRequest: JsonRpcTransactionRequest,
    origin: string
  ): Promise<SignedTransaction> {
    const annotation =
      origin === TALLY_INTERNAL_ORIGIN &&
      "annotation" in transactionRequest &&
      transactionRequest.annotation !== undefined
        ? // We use  `as` here as we know it's from a trusted source.
          (decodeJSON(transactionRequest.annotation) as TransactionAnnotation)
        : undefined

    if (!transactionRequest.from) {
      throw new Error("Transactions must have a from address for signing.")
    }

    /*let currentNetwork = await this.getCurrentOrDefaultNetworkForOrigin(
      origin
    )*/
    const currentNetwork = globalThis.main.store.getState().ui.selectedAccount.network


    const isRootstock = currentNetwork.chainID === ROOTSTOCK.chainID

    if (isRootstock) {
      ;[transactionRequest.from, transactionRequest.to].forEach((address) => {
        if (
          address &&
          isMixedCaseAddress(address) &&
          !isValidChecksumAddress(address, +currentNetwork.chainID)
        ) {
          throw new Error("Bad address checksum")
        }
      })
    }

    const { from, ...convertedRequest } =
      transactionRequestFromEthersTransactionRequest({
        // Convert input -> data if necessary; if transactionRequest uses data
        // directly, it will be overwritten below. If someone sends both and
        // they differ, may devops199 have mercy on their soul (but we will
        // prefer the explicit `data` rather than the copied `input`).
        data: transactionRequest.input,
        ...transactionRequest,
        gasLimit: transactionRequest.gas, // convert gas -> gasLimit
        // Etherjs rejects Rootstock checksummed addresses so convert to lowercase
        from: isRootstock
          ? normalizeHexAddress(transactionRequest.from)
          : transactionRequest.from,
        to: isRootstock
          ? transactionRequest.to && normalizeHexAddress(transactionRequest.to)
          : transactionRequest.to,
      })

    if (typeof from === "undefined") {
      throw new Error("Transactions must have a from address for signing.")
    }

    return new Promise<SignedTransaction>((resolve, reject) => {
      this.emitter.emit("transactionSignatureRequest", {
        payload: {
          ...convertedRequest,
          from,
          network: currentNetwork,
          annotation,
        },
        resolver: resolve,
        rejecter: reject,
      })
    })
  }

  /**
   * Attempts to retrieve a network from the extension's currently
   * tracked networks.  Falls back to querying supported networks and
   * tracking a given network if it is supported.
   *
   * @param chainID EVM Network chainID
   * @returns a supported EVMNetwork or undefined.
   */
  async getTrackedNetworkByChainId(
    chainID: string
  ): Promise<EVMNetwork | undefined> {
    const trackedNetworks = await this.chainService.getTrackedNetworks()
    const trackedNetwork = trackedNetworks.find((network) =>
      sameChainID(network.chainID, chainID)
    )

    if (trackedNetwork) {
      return trackedNetwork
    }

    try {
      const newlyTrackedNetwork =
        await this.chainService.startTrackingNetworkOrThrow(chainID)
      return newlyTrackedNetwork
    } catch (e) {
      logger.warn(e)
      return undefined
    }
  }

  private async signTypedData(params: SignTypedDataRequest) {
    // Ethers does not want to see the EIP712Domain field, extract it.
    const { EIP712Domain, ...typesForSigning } = params.typedData.types

    // Ask Ethers to give us a filtered payload that only includes types
    // specified in the `types` object.
    const filteredTypedDataPayload = _TypedDataEncoder.getPayload(
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
    supportedNetwork: EVMNetwork
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
