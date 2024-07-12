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
  SigningService,
} from "../services"
import {
  PriorityQueuedTxToRetrieve,
  QueuedTxToRetrieve,
} from "../services/chain"
import { QuaiNetworkGA } from "../constants/networks/networks"
import {
  QuaiTransactionState,
  QuaiTransactionStatus,
} from "../services/chain/types"

const createRandom0xHash = () =>
  keccak256(Buffer.from(Math.random().toString()))

export const createPreferenceService = async (): Promise<PreferenceService> => {
  return PreferenceService.create()
}

export const createKeyringService = async (): Promise<KeyringService> => {
  return KeyringService.create()
}

type CreateChainServiceOverrides = {
  preferenceService?: Promise<PreferenceService>
  keyringService?: Promise<KeyringService>
}

export const createChainService = async (
  overrides: CreateChainServiceOverrides = {}
): Promise<ChainService> => {
  return ChainService.create(
    overrides.preferenceService ?? createPreferenceService(),
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
}): Promise<IndexingService> {
  const preferenceService =
    overrides?.preferenceService ?? createPreferenceService()

  return IndexingService.create(
    preferenceService,
    overrides?.chainService ?? createChainService({ preferenceService }),
    overrides?.dexieOptions
  )
}

type CreateSigningServiceOverrides = {
  keyringService?: Promise<KeyringService>
  chainService?: Promise<ChainService>
}

type CreateProviderBridgeServiceOverrides = {
  internalQuaiProviderService?: Promise<InternalQuaiProviderService>
  preferenceService?: Promise<PreferenceService>
}

type CreateInternalQuaiProviderServiceOverrides = {
  chainService?: Promise<ChainService>
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

export const createSigningService = async (
  overrides: CreateSigningServiceOverrides = {}
): Promise<SigningService> => {
  return SigningService.create(
    overrides.keyringService ?? createKeyringService(),
    overrides.chainService ?? createChainService()
  )
}

export const createInternalQuaiProviderService = async (
  overrides: CreateInternalQuaiProviderServiceOverrides = {}
): Promise<InternalQuaiProviderService> => {
  return InternalQuaiProviderService.create(
    overrides.chainService ?? createChainService(),
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

export const createAnyEVMTransaction = (
  overrides: Partial<QuaiTransactionState> = {}
): any => {
  return {
    status: QuaiTransactionStatus.PENDING,
    blockHash: createRandom0xHash(),
    blockHeight: null,
    from: "0x208e94d5661a73360d9387d3ca169e5c130090cd",
    gasLimit: 527999n,
    gasPrice: 40300000000n,
    hash: createRandom0xHash(),
    data: "0x415565b0000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee000000000000000000000000f4c83080e80ae530d6f8180572cbbf1ac9d5d43500000000000000000000000000000000000000000000000006f05b59d3b2000000000000000000000000000000000000000000000000000084784181bd7017cc00000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000004a000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000900000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000040000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee00000000000000000000000000000000000000000000000006f05b59d3b20000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf12700000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa84174000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000006f05b59d3b2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000012556e697377617056330000000000000000000000000000000000000000000000000000000000000006f05b59d3b200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000e592427a0aece92de3edee1f18e0157c058615640000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002b0d500b1d8e8ef31e21c99d1db9a6444d3adf12700001f42791bca1f2de4661ed88a30c99a7a9449aa8417400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa84174000000000000000000000000f4c83080e80ae530d6f8180572cbbf1ac9d5d435000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000002c000000000000000000000000000000000000000000000000000000000000002a0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000002517569636b5377617000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000008521d131bfaa40df000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000a5e0829caced8ffdd4de3c43696c57f7d7a678ff000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000020000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa84174000000000000000000000000f4c83080e80ae530d6f8180572cbbf1ac9d5d435000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000f4c83080e80ae530d6f8180572cbbf1ac9d5d43500000000000000000000000000000000000000000000000000a98fb0023a291400000000000000000000000099b36fdbc582d113af36a21eba06bfeab7b9be120000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000d500b1d8e8ef31e21c99d1db9a6444d3adf12700000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa84174000000000000000000000000eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000000000000000000000000000000000000000000000000000000000000869584cd00000000000000000000000099b36fdbc582d113af36a21eba06bfeab7b9be1200000000000000000000000000000000000000000000005ab9dccabd63136f33",
    maxFeePerGas: null,
    maxPriorityFeePerGas: null,
    chainId: QuaiNetworkGA.chainID,
    to: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
    type: 0,
    value: 500000000000000000n,
    ...overrides,
  }
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
    network: QuaiNetworkGA,
    ...overrides,
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
      homeNetwork: QuaiNetworkGA,
      contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    amount: 5000000n,
  },
  network: QuaiNetworkGA,
  blockHeight: BigInt(15547463),
  retrievedAt: Date.now(),
  dataSource: "local",
  ...overrides,
})

export const createAddressOnNetwork = (
  overrides: Partial<AddressOnNetwork> = {}
): AddressOnNetwork => ({
  address: createRandom0xHash(),
  network: QuaiNetworkGA,
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
  network: QuaiNetworkGA,
  ...overrides,
})

export const createQueuedTransaction = (
  overrides: Partial<QueuedTxToRetrieve> = {}
): QueuedTxToRetrieve => ({
  network: QuaiNetworkGA,
  hash: createRandom0xHash(),
  firstSeen: Date.now(),
  ...overrides,
})

export const createTransactionsToRetrieve = (
  numberOfTx = 100
): PriorityQueuedTxToRetrieve[] => {
  const NETWORKS = [QuaiNetworkGA]

  return [...Array(numberOfTx).keys()].map((_, ind) => ({
    transaction: createQueuedTransaction({
      network: NETWORKS[ind % NETWORKS.length],
    }),
    priority: 0,
  }))
}

export const createAccountData = (
  overrides: Partial<AccountData> = {}
): AccountData => {
  return {
    address: createAddressOnNetwork().address,
    network: QuaiNetworkGA,
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
    homeNetwork: QuaiNetworkGA,
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
