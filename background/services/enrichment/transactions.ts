import { LogParams, Shard, toBigInt } from "quais"
import { AnyEVMBlock, isEIP1559TransactionRequest } from "../../networks"
import {
  AnyAsset,
  isSmartContractFungibleAsset,
  SmartContractFungibleAsset,
} from "../../assets"
import { enrichAssetAmountWithDecimalValues } from "../../redux-slices/utils/asset-utils"
import { sameQuaiAddress } from "../../lib/utils"
import ChainService from "../chain"
import IndexingService from "../indexing"
import NameService from "../name"
import { TransactionAnnotation, EnrichedAddressOnNetwork } from "./types"
import {
  getDistinctRecipentAddressesFromERC20Logs,
  getERC20LogsForAddresses,
} from "./utils"
import { enrichAddressOnNetwork } from "./addresses"
import { SECOND } from "../../constants"
import { parseLogsForWrappedDepositsAndWithdrawals } from "../../lib/wrappedAsset"
import {
  ERC20TransferLog,
  parseERC20Tx,
  parseLogsForERC20Transfers,
} from "../../lib/erc20"
import { isDefined, isFulfilledPromise } from "../../lib/utils/type-guards"
import { getExtendedZoneForAddress, getNetworkById } from "../chain/utils"
import { NetworkInterface } from "../../constants/networks/networkTypes"
import { SerializedTransactionForHistory } from "../chain/types"
import logger from "../../lib/logger"

async function buildSubannotations(
  chainService: ChainService,
  nameService: NameService,
  relevantTransferLogs: ERC20TransferLog[],
  assets: AnyAsset[],
  addressEnrichmentsByAddress: {
    [k: string]: EnrichedAddressOnNetwork
  },
  network: NetworkInterface,
  desiredDecimals: number,
  resolvedTime: number,
  block: AnyEVMBlock | undefined
) {
  const subannotations = (
    await Promise.allSettled(
      relevantTransferLogs.map(
        async ({
          contractAddress,
          amount,
          senderAddress,
          recipientAddress,
        }) => {
          // See if the address matches a fungible asset.
          const matchingFungibleAsset = assets.find(
            (asset): asset is SmartContractFungibleAsset =>
              isSmartContractFungibleAsset(asset) &&
              sameQuaiAddress(asset.contractAddress, contractAddress)
          )

          if (!matchingFungibleAsset) return undefined

          // Try to find a resolved annotation for the recipient and sender and otherwise fetch them
          const recipient =
            addressEnrichmentsByAddress[recipientAddress] ??
            (await enrichAddressOnNetwork(chainService, nameService, {
              address: recipientAddress,
              network,
            }))
          const sender =
            addressEnrichmentsByAddress[senderAddress] ??
            (await enrichAddressOnNetwork(chainService, nameService, {
              address: senderAddress,
              network,
            }))

          return {
            type:
              getExtendedZoneForAddress(senderAddress, false) !==
              getExtendedZoneForAddress(recipientAddress, false)
                ? ("external-transfer" as const)
                : ("asset-transfer" as const),
            assetAmount: enrichAssetAmountWithDecimalValues(
              {
                asset: matchingFungibleAsset,
                amount,
              },
              desiredDecimals
            ),
            sender,
            recipient,
            timestamp: resolvedTime,
            blockTimestamp: block?.timestamp,
          }
        }
      )
    )
  )
    .filter(isFulfilledPromise)
    .map(({ value }) => value)
    .filter(isDefined)

  return subannotations
}

export async function annotationsFromLogs(
  chainService: ChainService,
  indexingService: IndexingService,
  nameService: NameService,
  logs: readonly LogParams[],
  network: NetworkInterface,
  desiredDecimals: number,
  resolvedTime: number,
  block: AnyEVMBlock | undefined
): Promise<TransactionAnnotation[]> {
  const assets = indexingService.getCachedAssets(network)

  const accountAddresses = (await chainService.getAccountsToTrack()).map(
    (account) => account.address
  )

  const tokenTransferLogs = [
    ...parseLogsForERC20Transfers(logs),
    ...parseLogsForWrappedDepositsAndWithdrawals(logs),
  ]

  const relevantTransferLogs = getERC20LogsForAddresses(
    tokenTransferLogs,
    accountAddresses
  )

  const relevantAddresses =
    getDistinctRecipentAddressesFromERC20Logs(relevantTransferLogs)

  // Look up transfer log names, then flatten to an address -> name map.
  const addressEnrichmentsByAddress = Object.fromEntries(
    (
      await Promise.allSettled(
        relevantAddresses.map(
          async (address) =>
            [
              address,
              await enrichAddressOnNetwork(chainService, nameService, {
                address,
                network,
              }),
            ] as const
        )
      )
    )
      .filter(isFulfilledPromise)
      .map(({ value }) => value)
      .filter(([, annotation]) => isDefined(annotation))
  )

  const subannotations = await buildSubannotations(
    chainService,
    nameService,
    relevantTransferLogs,
    assets,
    addressEnrichmentsByAddress,
    network,
    desiredDecimals,
    resolvedTime,
    block
  )

  return subannotations
}

/**
 * Resolve an annotation for a partial transaction request, or a pending
 * or mined transaction.
 */
let latestWorkedAsk = 0
let numAsks = 0
export default async function resolveTransactionAnnotation(
  chainService: ChainService,
  indexingService: IndexingService,
  nameService: NameService,
  network: NetworkInterface,
  transaction: SerializedTransactionForHistory,
  desiredDecimals: number
): Promise<TransactionAnnotation> {
  const assets = indexingService.getCachedAssets(network)
  const isExternalTransfer =
    !!transaction.type &&
    (transaction.type === 1 || transaction.type === 2) &&
    !!transaction.to
  const useDestinationShard = sameQuaiAddress(
    transaction.from,
    "0x0000000000000000000000000000000000000000"
  )

  let txAnnotation: TransactionAnnotation = {
    blockTimestamp: undefined,
    timestamp: Date.now(),
    type: "contract-deployment",
    transactionLogoURL: assets.find(
      (asset) =>
        asset.metadata?.logoURL &&
        asset.symbol === getNetworkById(transaction.chainId)?.baseAsset.symbol
    )?.metadata?.logoURL,
  }

  // We know this is an External Transfer, and transaction.to means not deployment
  if (useDestinationShard && transaction.to && transaction.from) {
    const recipient = await enrichAddressOnNetwork(chainService, nameService, {
      address: transaction.to,
      network,
    })
    const sender = await enrichAddressOnNetwork(chainService, nameService, {
      address: transaction.from,
      network,
    })

    txAnnotation = {
      ...txAnnotation,
      type: "external-transfer",
      sender,
      recipient,
      assetAmount: enrichAssetAmountWithDecimalValues(
        {
          asset: network.baseAsset,
          amount: toBigInt(transaction.value ?? 0n),
        },
        desiredDecimals
      ),
    }
  }

  if (numAsks > 10 && latestWorkedAsk + 5 * SECOND > Date.now()) {
    // eslint-disable-next-line no-console
    logger.info("Requesting tx annotations too often, skipping")
    return txAnnotation
  }
  if (numAsks > 10 && latestWorkedAsk + 5 * SECOND < Date.now()) {
    numAsks = 0
  }
  // eslint-disable-next-line no-plusplus
  numAsks++
  latestWorkedAsk = Date.now()

  let block: AnyEVMBlock | undefined

  if (!transaction.from) throw new Error("Transaction from not found")

  const {
    assetAmount: { amount: baseAssetBalance },
  } = await chainService.getLatestBaseAccountBalance({
    address: transaction.from,
    network,
  })

  const { gasLimit, blockHash } = transaction

  const additionalL1Gas = 0n
  const gasFee: bigint = isEIP1559TransactionRequest(transaction)
    ? toBigInt(transaction?.maxFeePerGas ?? 0n) * toBigInt(gasLimit ?? 0n) +
      additionalL1Gas
    : toBigInt(transaction?.gasPrice ?? 0n) * toBigInt(gasLimit ?? 0n) +
      additionalL1Gas

  txAnnotation.warnings ??= []

  // If the wallet doesn't have enough base asset to cover gas, push a warning
  if (
    toBigInt(gasFee ?? 0) + toBigInt(transaction.value ?? 0) >
    baseAssetBalance
  ) {
    if (!txAnnotation.warnings.includes("insufficient-funds")) {
      txAnnotation.warnings.push("insufficient-funds")
    }
  } else {
    txAnnotation.warnings = txAnnotation.warnings.filter(
      (warning) => warning !== "insufficient-funds"
    )
  }

  // If the transaction has been mined, get the block and set the timestamp
  if (blockHash) {
    try {
      block =
        useDestinationShard && transaction.to
          ? await chainService.getBlockByHash(
              network,
              getExtendedZoneForAddress(transaction.to, false) as Shard,
              blockHash
            )
          : await chainService.getBlockByHash(
              network,
              getExtendedZoneForAddress(transaction.from, false) as Shard,
              blockHash
            )

      txAnnotation = {
        ...txAnnotation,
        blockTimestamp: block?.timestamp,
      }
    } catch (e) {
      logger.error(e)
      chainService
        .getTransactionFirstSeenFromDB(transaction?.hash)
        .then((date) => {
          txAnnotation = {
            ...txAnnotation,
            blockTimestamp: date,
          }
        })
    }
  }

  // If the tx has a recipient, its a contract interaction or another tx type
  // rather than a deployment.
  if (transaction.to) {
    const contractInfo = await enrichAddressOnNetwork(
      chainService,
      nameService,
      {
        address: transaction.to,
        network,
      }
    )

    txAnnotation =
      txAnnotation.type === "contract-deployment"
        ? {
            ...txAnnotation,
            type: "contract-interaction",
            contractInfo: await enrichAddressOnNetwork(
              chainService,
              nameService,
              {
                address: transaction.to,
                network,
              }
            ),
          }
        : txAnnotation

    if (transaction.data === "0x" && transaction.value) {
      // If the tx has no data, it's either a simple ETH send, or it's relying
      // on a contract that's `payable` to execute code
      const recipient = contractInfo
      const sender = await enrichAddressOnNetwork(chainService, nameService, {
        address: transaction.from,
        network,
      })

      // This is _almost certainly_ not a contract interaction, move on. Note that
      // a simple ETH send to a contract address can still effectively be a
      // contract interaction (because it calls the fallback function on the
      // contract), but for now we deliberately ignore that scenario when
      // categorizing activities.
      // TODO We can do more here by checking how much gas was spent. Anything
      // over the 21k required to send ETH is a more complex contract interaction
      if (typeof transaction.value !== "undefined") {
        // Warn if we're sending ETH to a contract. This is normal if you're
        // funding a multisig or exchange, but it's good to double check
        // If the annotation is a built-in contract or in the address book,
        // skip the warning.
        if (
          recipient.annotation.hasCode &&
          !(recipient.annotation.nameRecord?.system === "tally-address-book")
        ) {
          txAnnotation.warnings ??= []
          txAnnotation.warnings.push("send-to-contract")
        }

        txAnnotation = {
          ...txAnnotation,
          type: isExternalTransfer ? "external-transfer" : "asset-transfer",
          sender,
          recipient,
          assetAmount: enrichAssetAmountWithDecimalValues(
            {
              asset: network.baseAsset,
              amount: toBigInt(transaction.value ?? 0),
            },
            desiredDecimals
          ),
        }
      }
    } else {
      const erc20Tx = transaction?.data && parseERC20Tx(transaction.data)

      // See if the address matches a fungible asset.
      const matchingFungibleAsset = assets.find(
        (asset): asset is SmartContractFungibleAsset =>
          isSmartContractFungibleAsset(asset) &&
          sameQuaiAddress(asset.contractAddress, transaction.to)
      )

      const transactionLogoURL = matchingFungibleAsset?.metadata?.logoURL

      // TODO handle the case where we don't have asset metadata already
      if (
        matchingFungibleAsset &&
        erc20Tx &&
        (erc20Tx.name === "transfer" || erc20Tx.name === "transferFrom")
      ) {
        const [sender, recipient] = await Promise.all([
          enrichAddressOnNetwork(chainService, nameService, {
            address: erc20Tx.args.from ?? transaction.from,
            network,
          }),
          enrichAddressOnNetwork(chainService, nameService, {
            address: erc20Tx.args.to,
            network,
          }),
        ])

        // We have an ERC-20 transfer
        txAnnotation = {
          ...txAnnotation,
          type: isExternalTransfer ? "external-transfer" : "asset-transfer",
          transactionLogoURL,
          sender,
          recipient,
          assetAmount: enrichAssetAmountWithDecimalValues(
            {
              asset: matchingFungibleAsset,
              amount: BigInt(erc20Tx.args.amount),
            },
            desiredDecimals
          ),
        }
        // Warn if we're sending the token to its own contract
        if (sameQuaiAddress(erc20Tx.args.to, transaction.to)) {
          txAnnotation.warnings ??= []
          txAnnotation.warnings.push("send-to-token")
        }
        // Warn if we're sending the token to a contract. This is normal if
        // you're funding a multisig or exchange, but it's good to double check.
        // If the annotation is a built-in contract or in the address book,
        // skip the warning.
        if (
          recipient.annotation.hasCode &&
          !(recipient.annotation.nameRecord?.system === "tally-address-book")
        ) {
          txAnnotation.warnings ??= []
          txAnnotation.warnings.push("send-to-contract")
        }
      } else if (
        matchingFungibleAsset &&
        erc20Tx &&
        erc20Tx.name === "approve"
      ) {
        const spender = await enrichAddressOnNetwork(
          chainService,
          nameService,
          {
            address: erc20Tx.args.spender,
            network,
          }
        )
        // Warn if we're approving spending to a likely EOA. Note this will also
        // sweep up CREATE2 contracts that haven't yet been deployed
        if (!spender.annotation.hasCode) {
          txAnnotation.warnings ??= []
          txAnnotation.warnings.push("approve-eoa")
        }
        txAnnotation = {
          ...txAnnotation,
          type: "asset-approval",
          transactionLogoURL,
          spender,
          assetAmount: enrichAssetAmountWithDecimalValues(
            {
              asset: matchingFungibleAsset,
              amount: BigInt(erc20Tx.args.value),
            },
            desiredDecimals
          ),
        }
      }
    }
  }

  // Look up logs and resolve subannotations, if available.
  if (transaction?.logs?.length) {
    const subannotations = await annotationsFromLogs(
      chainService,
      indexingService,
      nameService,
      transaction.logs,
      network,
      desiredDecimals,
      txAnnotation.timestamp,
      block
    )

    if (subannotations?.length) {
      txAnnotation.subannotations = subannotations
    }
  }

  return txAnnotation
}
