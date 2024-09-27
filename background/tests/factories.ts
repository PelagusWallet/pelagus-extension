/* eslint-disable class-methods-use-this */
import { DexieOptions } from "dexie"
import { keccak256 } from "quais"
import { AccountBalance, AddressOnNetwork } from "../accounts"
import {
  AnyAsset,
  AnyAssetAmount,
  flipPricePoint,
  isFungibleAsset,
  PricePoint,
  SmartContractFungibleAsset,
} from "../assets"
import { COIN_TYPES_BY_ASSET_SYMBOL, QUAI, USD } from "../constants"
import { AnyEVMBlock, BlockPrices, NetworkBaseAsset } from "../networks"
import { AccountData, CompleteAssetAmount } from "../redux-slices/accounts"
import {
  AnalyticsService,
  ChainService,
  IndexingService,
  InternalQuaiProviderService,
  KeyringService,
  NameService,
  PreferenceService,
  ProviderBridgeService,
  // SigningService,
} from "../services"
import { QuaiGoldenAgeTestnet } from "../constants/networks/networks"
import ProviderFactory from "../services/provider-factory/provider-factory"
import BlockService from "../services/block"
import TransactionService from "../services/transactions"

const createRandom0xHash = () =>
  keccak256(Buffer.from(Math.random().toString()))

export const createPreferenceService = async (): Promise<PreferenceService> => {
  return PreferenceService.create()
}

type CreateProviderFactoryServiceOverrides = {
  preferenceService?: Promise<PreferenceService>
}

export const createProviderFactoryService = async (
  overrides: CreateProviderFactoryServiceOverrides = {}
): Promise<ProviderFactory> => {
  return ProviderFactory.create(
    overrides.preferenceService ?? createPreferenceService()
  )
}

export const createKeyringService = async (): Promise<KeyringService> => {
  return KeyringService.create()
}

type CreateChainServiceOverrides = {
  providerFactoryService?: Promise<ProviderFactory>
  preferenceService?: Promise<PreferenceService>
  keyringService?: Promise<KeyringService>
}

export const createChainService = async (
  overrides: CreateChainServiceOverrides = {}
): Promise<ChainService> => {
  return ChainService.create(
    overrides.providerFactoryService ?? createProviderFactoryService(),
    overrides.preferenceService ?? createPreferenceService(),
    overrides.keyringService ?? createKeyringService()
  )
}

type CreateTransactionServiceOverrides = {
  chainService?: Promise<ChainService>
  keyringService?: Promise<KeyringService>
}

export const createTransactionService = async (
  overrides: CreateTransactionServiceOverrides = {}
): Promise<TransactionService> => {
  return TransactionService.create(
    overrides.chainService ?? createChainService(),
    overrides.keyringService ?? createKeyringService()
  )
}

export async function createNameService(overrides?: {
  chainService?: Promise<ChainService>
  preferenceService?: Promise<PreferenceService>
}): Promise<NameService> {
  const preferenceService =
    overrides?.preferenceService ?? createPreferenceService()
  return NameService.create(
    overrides?.chainService ?? createChainService({ preferenceService }),
    preferenceService
  )
}

export async function createIndexingService(overrides?: {
  chainService?: Promise<ChainService>
  preferenceService?: Promise<PreferenceService>
  dexieOptions?: DexieOptions
  blockService: Promise<BlockService>
  transactionService?: Promise<TransactionService>
}): Promise<IndexingService> {
  const preferenceService =
    overrides?.preferenceService ?? createPreferenceService()
  const chainService =
    overrides?.chainService ?? createChainService({ preferenceService })

  return IndexingService.create(
    preferenceService,
    chainService,
    overrides?.transactionService ?? createTransactionService(),
    BlockService.create(chainService, preferenceService),
    overrides?.dexieOptions
  )
}

// type CreateSigningServiceOverrides = {
//   keyringService?: Promise<KeyringService>
//   chainService?: Promise<ChainService>
// }

type CreateProviderBridgeServiceOverrides = {
  internalQuaiProviderService?: Promise<InternalQuaiProviderService>
  preferenceService?: Promise<PreferenceService>
}

type CreateInternalQuaiProviderServiceOverrides = {
  chainService?: Promise<ChainService>
  transactionService?: Promise<TransactionService>
  preferenceService?: Promise<PreferenceService>
}

export async function createAnalyticsService(overrides?: {
  chainService?: Promise<ChainService>
  preferenceService?: Promise<PreferenceService>
}): Promise<AnalyticsService> {
  const preferenceService =
    overrides?.preferenceService ?? createPreferenceService()
  return AnalyticsService.create(preferenceService)
}

// export const createSigningService = async (
//   overrides: CreateSigningServiceOverrides = {}
// ): Promise<SigningService> => {
//   return SigningService.create(
//     overrides.keyringService ?? createKeyringService(),
//     overrides.chainService ?? createChainService()
//   )
// }

export const createInternalQuaiProviderService = async (
  overrides: CreateInternalQuaiProviderServiceOverrides = {}
): Promise<InternalQuaiProviderService> => {
  return InternalQuaiProviderService.create(
    overrides.chainService ?? createChainService(),
    overrides.transactionService ?? createTransactionService(),
    overrides.preferenceService ?? createPreferenceService()
  )
}

export const createProviderBridgeService = async (
  overrides: CreateProviderBridgeServiceOverrides = {}
): Promise<ProviderBridgeService> => {
  const preferenceService =
    overrides?.preferenceService ?? createPreferenceService()
  return ProviderBridgeService.create(
    overrides.internalQuaiProviderService ??
      createInternalQuaiProviderService({ preferenceService }),
    preferenceService
  )
}

export const createAnyEVMBlock = (
  overrides: Partial<AnyEVMBlock> = {}
): AnyEVMBlock => {
  return {
    hash: createRandom0xHash(),
    parentHash: createRandom0xHash(),
    difficulty: 1000000000000n,
    blockHeight: 15547463,
    timestamp: Date.now(),
    baseFeePerGas: overrides.baseFeePerGas ? overrides.baseFeePerGas : 0n,
    network: QuaiGoldenAgeTestnet,
  }
}

export const createAccountBalance = (
  overrides: Partial<AccountBalance> = {}
): AccountBalance => ({
  address: createRandom0xHash(),
  assetAmount: {
    asset: {
      metadata: {
        tokenLists: [],
      },
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      homeNetwork: QuaiGoldenAgeTestnet,
      contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    amount: 5000000n,
  },
  network: QuaiGoldenAgeTestnet,
  blockHeight: BigInt(15547463),
  retrievedAt: Date.now(),
  dataSource: "local",
  ...overrides,
})

export const createAddressOnNetwork = (
  overrides: Partial<AddressOnNetwork> = {}
): AddressOnNetwork => ({
  address: createRandom0xHash(),
  network: QuaiGoldenAgeTestnet,
  ...overrides,
})

export const createBlockPrices = (
  overrides: Partial<BlockPrices> = {}
): BlockPrices => ({
  baseFeePerGas: 0n,
  blockNumber: 25639147,
  dataSource: "local",
  estimatedPrices: [
    {
      confidence: 99,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
      price: 1001550n,
    },
  ],
  network: QuaiGoldenAgeTestnet,
  ...overrides,
})

export const createAccountData = (
  overrides: Partial<AccountData> = {}
): AccountData => {
  return {
    address: createAddressOnNetwork().address,
    network: QuaiGoldenAgeTestnet,
    balances: {},
    customAccountData: {
      name: "test.crypto",
    },
    defaultName: "Test",
    defaultAvatar: "test.png",
    ...overrides,
  }
}

const getRandomStr = (length: number) => {
  let result = ""
  while (result.length < length) {
    result += Math.random().toString(36).slice(2)
  }

  return result.slice(0, length)
}

export const createSmartContractAsset = (
  overrides: Partial<SmartContractFungibleAsset> = {}
): SmartContractFungibleAsset => {
  const symbol = overrides.symbol ?? getRandomStr(3)
  const asset = {
    metadata: {
      logoURL:
        "https://messari.io/asset-images/0783ede3-4b2c-418a-9f82-f171894c70e2/128.png",
      tokenLists: [
        {
          url: "https://gateway.ipfs.io/ipns/tokens.uniswap.org",
          name: "Uniswap Labs Default",
          logoURL: "ipfs://QmNa8mQkrNKp1WEEeGjFezDmDeodkWRevGFN8JCV7b4Xir",
        },
      ],
    },
    name: `${symbol} Network`,
    symbol,
    decimals: 18,
    homeNetwork: QuaiGoldenAgeTestnet,
    contractAddress: createRandom0xHash(),
  }

  return {
    ...asset,
    ...overrides,
  }
}

export const createNetworkBaseAsset = (
  overrides: Partial<NetworkBaseAsset> = {}
): NetworkBaseAsset => {
  const symbol = getRandomStr(3)
  const asset: NetworkBaseAsset = {
    metadata: {
      logoURL: "http://example.com/foo.png",
      tokenLists: [],
    },
    name: `${symbol} Network`,
    symbol,
    decimals: 18,
    coinType: COIN_TYPES_BY_ASSET_SYMBOL.QUAI,
    chainID: "1",
    contractAddress: createRandom0xHash(),
  }

  return {
    ...asset,
    ...overrides,
  }
}

export const createAssetAmount = (
  asset: AnyAsset = QUAI,
  amount = 1
): AnyAssetAmount => {
  return {
    asset,
    amount: BigInt(Math.trunc(1e10 * amount)) * 10n ** 8n,
  }
}

export const createCompleteAssetAmount = (
  asset: AnyAsset = QUAI,
  amount = 1,
  overrides: Partial<CompleteAssetAmount<AnyAsset>> = {}
): CompleteAssetAmount<AnyAsset> => {
  const assetAmount = createAssetAmount(asset, amount)
  return {
    ...assetAmount,
    decimalAmount: amount,
    localizedDecimalAmount: amount.toFixed(2),
    ...overrides,
  }
}
/**
 * @param asset Any type of asset
 * @param price Price, e.g. 1.5 => 1.5$
 * @param flip Return assets and amounts in reverse order
 */
export const createPricePoint = (
  asset: AnyAsset,
  price = 1,
  flip = false
): PricePoint => {
  const decimals = isFungibleAsset(asset) ? asset.decimals : 18

  const pricePoint: PricePoint = {
    pair: [asset, USD],
    amounts: [10n ** BigInt(decimals), BigInt(Math.trunc(1e10 * price))],
    time: Math.trunc(Date.now() / 1e3),
  }

  return flip ? flipPricePoint(pricePoint) : pricePoint
}

export const createArrayWith0xHash = (length: number): string[] =>
  Array.from({ length }).map(() => createRandom0xHash())
