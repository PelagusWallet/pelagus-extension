import {
  AbiCoder,
  Interface,
  ZeroHash,
  getAddress,
  isAddress,
  keccak256,
  solidityPackedKeccak256,
  toUtf8Bytes,
} from "quais"
import {
  EIP1193Error,
  EIP1193_ERROR_CODES,
  PELAGUS_QNS_GET_MODULE_METHOD,
  PELAGUS_QNS_OPEN_METHOD,
  PELAGUS_QNS_RESOLVE_NAME_METHOD,
  PelagusQNSAnchorPayload,
  PelagusQNSGetModuleResult,
  PelagusQNSOpenResult,
  PelagusQNSResolveNameResult,
  RPCRequest,
} from "@pelagus-provider/provider-bridge-shared"

const ANCHOR_VERSION = 1
const ANCHOR_BYTES = 96

const MODULE_IDS = {
  topologyRedirect: keccak256(toUtf8Bytes("qns.topology.redirect.v1")),
  topologyStaticSite: keccak256(toUtf8Bytes("qns.topology.static-site.v1")),
  rendererRedirect: keccak256(toUtf8Bytes("qns.renderer.redirect.v1")),
  rendererStaticSafe: keccak256(toUtf8Bytes("qns.renderer.static-safe.v1")),
  contentModeNone: ZeroHash,
}

const anchorRegistryInterface = new Interface([
  "function nameResolver() view returns (address)",
  "function anchorOf(bytes32 nameHash) view returns (bytes)",
])

const nameResolverInterface = new Interface([
  "function ownerOfName(bytes32 nameHash) view returns (address owner, bool active)",
])

const qnnsInterface = new Interface([
  "function isActive(bytes32 nameHash) view returns (bool)",
  "function ownerOf(uint256 tokenId) view returns (address)",
])

const moduleInterface = new Interface([
  "function moduleVersion() view returns (uint16)",
  "function moduleTopology() view returns (bytes32)",
  "function moduleManifestHash() view returns (bytes32)",
  "function moduleManifest() view returns (bytes)",
])

const manifestCoder = AbiCoder.defaultAbiCoder()
const moduleManifestV1Abi =
  "tuple(uint16,bytes32,bytes32,bytes32,string,string,tuple(uint32,bytes32[]),tuple(uint32,uint32,uint32,uint32,uint32),bytes)"

type SafeRPCRequest = (
  method: string,
  params: Array<unknown>,
  origin: string
) => Promise<unknown>

type QNSAddressConfig = {
  qnnsAddress: string
  qnsNameResolverAddress: string
  qnsAnchorRegistryAddress: string
}

type QNSProviderContext = {
  method: string
  params: RPCRequest["params"]
  origin: string
  chainId: string
  routeSafeRPCRequest: SafeRPCRequest
}

type NameInput = {
  name: string
  qnnsAddress?: string
  qnsNameResolverAddress?: string
  qnsAnchorRegistryAddress?: string
}

type ModuleInput = NameInput & {
  moduleAddress?: string
}

type ParsedQNSTarget = {
  name?: string
  moduleAddress?: string
}

const QNS_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

function firstConfigured(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? ""
}

function qnsConfigForChain(chainId: string): QNSAddressConfig {
  const byChain: Record<string, QNSAddressConfig> = {
    "9": {
      qnnsAddress: process.env.QNS_MAINNET_QNNS_ADDRESS ?? "",
      qnsNameResolverAddress:
        process.env.QNS_MAINNET_NAME_RESOLVER_ADDRESS ?? "",
      qnsAnchorRegistryAddress:
        process.env.QNS_MAINNET_ANCHOR_REGISTRY_ADDRESS ?? "",
    },
    "15000": {
      qnnsAddress: process.env.QNS_ORCHARD_QNNS_ADDRESS ?? "",
      qnsNameResolverAddress:
        process.env.QNS_ORCHARD_NAME_RESOLVER_ADDRESS ?? "",
      qnsAnchorRegistryAddress:
        process.env.QNS_ORCHARD_ANCHOR_REGISTRY_ADDRESS ?? "",
    },
    "17000": {
      qnnsAddress: process.env.QNS_LOCAL_QNNS_ADDRESS ?? "",
      qnsNameResolverAddress:
        process.env.QNS_LOCAL_NAME_RESOLVER_ADDRESS ?? "",
      qnsAnchorRegistryAddress:
        process.env.QNS_LOCAL_ANCHOR_REGISTRY_ADDRESS ?? "",
    },
  }

  return {
    qnnsAddress: firstConfigured(
      process.env.QNS_QNNS_ADDRESS,
      byChain[chainId]?.qnnsAddress
    ),
    qnsNameResolverAddress: firstConfigured(
      process.env.QNS_NAME_RESOLVER_ADDRESS,
      byChain[chainId]?.qnsNameResolverAddress
    ),
    qnsAnchorRegistryAddress: firstConfigured(
      process.env.QNS_ANCHOR_REGISTRY_ADDRESS,
      byChain[chainId]?.qnsAnchorRegistryAddress
    ),
  }
}

function gatewayBaseUrl(): string {
  return (process.env.QNS_GATEWAY_BASE_URL || "https://qns.app").replace(
    /\/+$/,
    ""
  )
}

function gatewayModulesUrl(
  params: Record<string, string | null | undefined>
): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value)
  }
  return `${gatewayBaseUrl()}/modules?${searchParams.toString()}`
}

function toHexChainId(chainId: string | bigint): string {
  if (typeof chainId === "string" && chainId.startsWith("0x")) {
    return `0x${BigInt(chainId).toString(16)}`
  }
  return `0x${BigInt(chainId).toString(16)}`
}

function normalizeQNSName(input: string): string {
  let value = parseQNSTarget(input).name ?? String(input || "").trim()

  if (value.endsWith(".quai")) value = value.slice(0, -5)
  if (value.endsWith(".qns")) value = value.slice(0, -4)
  value = value.toLowerCase()

  const bytes = toUtf8Bytes(value)
  if (bytes.length === 0 || bytes.length > 64 || !/^[a-z0-9_-]+$/.test(value)) {
    throw new EIP1193Error({
      ...EIP1193_ERROR_CODES.unsupportedMethod,
      data: {
        reason:
          "Invalid QNS name. Use 1-64 lowercase ASCII letters, numbers, hyphens, or underscores.",
      },
    })
  }

  return value
}

function hashQNSName(input: string): string {
  return solidityPackedKeccak256(["string"], [normalizeQNSName(input)])
}

function isQNSAddress(value: string): boolean {
  return QNS_ADDRESS_PATTERN.test(value)
}

function gatewayHostname(): string {
  try {
    return new URL(gatewayBaseUrl()).hostname.toLowerCase()
  } catch (_) {
    return "qns.app"
  }
}

function parseQNSTarget(input: unknown): ParsedQNSTarget {
  const value = String(input || "").trim()
  if (!value) return {}

  if (isQNSAddress(value)) return { moduleAddress: getAddress(value) }

  if (value.toLowerCase().startsWith("qns://")) {
    const rawTarget = value.slice(6).split(/[/?#]/)[0] || ""
    const target = decodeURIComponent(rawTarget)
    if (isQNSAddress(target)) return { moduleAddress: getAddress(target) }
    return { name: target }
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      const host = url.hostname.toLowerCase()
      if (host.endsWith(".quai")) {
        const target = decodeURIComponent(host.slice(0, -5))
        if (isQNSAddress(target)) return { moduleAddress: getAddress(target) }
        return { name: target }
      }

      if (host === "qns.app" || host === gatewayHostname()) {
        const moduleParam =
          url.searchParams.get("module") ||
          url.searchParams.get("moduleAddress")
        if (moduleParam && isQNSAddress(moduleParam)) {
          return { moduleAddress: getAddress(moduleParam) }
        }

        const nameParam =
          url.searchParams.get("name") || url.searchParams.get("qns")
        if (nameParam) return { name: nameParam }

        const firstPathSegment = decodeURIComponent(
          url.pathname.split("/").filter(Boolean)[0] || ""
        )
        if (isQNSAddress(firstPathSegment)) {
          return { moduleAddress: getAddress(firstPathSegment) }
        }
        if (firstPathSegment && firstPathSegment !== "modules") {
          return { name: firstPathSegment }
        }
      }
    } catch (_) {
      return { name: value }
    }
  }

  const bareHost = value.split(/[/?#]/)[0].toLowerCase()
  if (bareHost.endsWith(".quai")) {
    const target = decodeURIComponent(bareHost.slice(0, -5))
    if (isQNSAddress(target)) return { moduleAddress: getAddress(target) }
    return { name: target }
  }

  return { name: value }
}

function decodeAnchor(encodedAnchor: string): PelagusQNSAnchorPayload {
  const hex = encodedAnchor.startsWith("0x")
    ? encodedAnchor.slice(2)
    : encodedAnchor
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length !== ANCHOR_BYTES * 2) {
    throw new EIP1193Error({
      ...EIP1193_ERROR_CODES.unsupportedMethod,
      data: { reason: `Invalid QNS anchor. Expected ${ANCHOR_BYTES} bytes.` },
    })
  }

  return {
    version: Number.parseInt(hex.slice(0, 4), 16),
    flags: Number.parseInt(hex.slice(4, 8), 16),
    chainId: toHexChainId(BigInt(`0x${hex.slice(8, 24)}`)),
    moduleAddress: getAddress(`0x${hex.slice(24, 64)}`),
    topology: `0x${hex.slice(64, 128)}`,
    manifestHash: `0x${hex.slice(128, 192)}`,
    encodedAnchor: `0x${hex}`,
  }
}

function decodeModuleManifest(manifest: string) {
  const decoded = manifestCoder.decode(
    [moduleManifestV1Abi],
    manifest
  )[0] as any
  const permissionPolicy = decoded[6] as any
  const resourceBudget = decoded[7] as any

  return {
    version: Number(decoded[0]),
    topology: String(decoded[1]),
    rendererId: String(decoded[2]),
    contentMode: String(decoded[3]),
    title: String(decoded[4]),
    defaultRoute: String(decoded[5]),
    permissionPolicy: {
      flags: Number(permissionPolicy[0]),
      providerMethodIds: Array.from(permissionPolicy[1] || []).map(String),
    },
    resourceBudget: {
      maxManifestBytes: Number(resourceBudget[0]),
      maxRoutePayloadBytes: Number(resourceBudget[1]),
      maxContractReads: Number(resourceBudget[2]),
      maxTotalLoadedBytes: Number(resourceBudget[3]),
      maxRenderMillis: Number(resourceBudget[4]),
    },
    topologyData: String(decoded[8]),
  }
}

function objectParam(params: RPCRequest["params"]): Record<string, unknown> {
  const first = params?.[0]
  if (typeof first === "object" && first !== null && !Array.isArray(first)) {
    return first as Record<string, unknown>
  }
  return {}
}

function configuredAddress(
  value: unknown,
  fallback: string,
  label: string
): string {
  const selected = typeof value === "string" && value ? value : fallback
  if (!selected) return ""
  if (!isAddress(selected)) {
    throw new EIP1193Error({
      ...EIP1193_ERROR_CODES.unsupportedMethod,
      data: { reason: `Invalid ${label} address.` },
    })
  }
  return getAddress(selected)
}

function parseNameInput(
  params: RPCRequest["params"],
  chainId: string
): NameInput {
  const first = params?.[0]
  const object = objectParam(params)
  const config = qnsConfigForChain(chainId)
  const rawName =
    typeof first === "string"
      ? first
      : typeof object.name === "string"
      ? object.name
      : typeof object.url === "string"
      ? object.url
      : ""
  const target = parseQNSTarget(rawName)

  return {
    name: target.name ?? "",
    qnnsAddress: configuredAddress(
      object.qnnsAddress,
      config.qnnsAddress,
      "QNNS"
    ),
    qnsNameResolverAddress: configuredAddress(
      object.qnsNameResolverAddress ?? object.nameResolverAddress,
      config.qnsNameResolverAddress,
      "QNS name resolver"
    ),
    qnsAnchorRegistryAddress: configuredAddress(
      object.qnsAnchorRegistryAddress ?? object.anchorRegistryAddress,
      config.qnsAnchorRegistryAddress,
      "QNS anchor registry"
    ),
  }
}

function parseModuleInput(
  params: RPCRequest["params"],
  chainId: string
): ModuleInput {
  const first = params?.[0]
  const object = objectParam(params)
  const nameInput = parseNameInput(params, chainId)
  const target = parseQNSTarget(
    typeof first === "string"
      ? first
      : typeof object.url === "string"
      ? object.url
      : typeof object.moduleAddress === "string"
      ? object.moduleAddress
      : typeof object.name === "string"
      ? object.name
      : ""
  )
  const moduleAddress =
    target.moduleAddress
      ? target.moduleAddress
      : typeof object.moduleAddress === "string"
      ? object.moduleAddress
      : undefined

  return {
    ...nameInput,
    moduleAddress: moduleAddress ? getAddress(moduleAddress) : undefined,
  }
}

async function callContract(
  routeSafeRPCRequest: SafeRPCRequest,
  origin: string,
  contractAddress: string,
  contractInterface: Interface,
  functionName: string,
  args: Array<unknown>
): Promise<any> {
  const data = contractInterface.encodeFunctionData(functionName, args)
  const result = await routeSafeRPCRequest(
    "quai_call",
    [{ to: contractAddress, data }],
    origin
  )
  if (typeof result !== "string") {
    throw new Error(`Invalid ${functionName} result.`)
  }
  return contractInterface.decodeFunctionResult(functionName, result)
}

async function readNameOwner(
  routeSafeRPCRequest: SafeRPCRequest,
  origin: string,
  qnsNameResolverAddress: string,
  qnnsAddress: string,
  nameHash: string
): Promise<{ active: boolean | null; owner: string | null }> {
  if (qnsNameResolverAddress) {
    try {
      const result = await callContract(
        routeSafeRPCRequest,
        origin,
        qnsNameResolverAddress,
        nameResolverInterface,
        "ownerOfName",
        [nameHash]
      )
      const owner = String(result[0])
      const active = Boolean(result[1])
      return { active, owner: active ? owner : null }
    } catch (_) {
      return { active: null, owner: null }
    }
  }

  if (!qnnsAddress) return { active: null, owner: null }

  try {
    const activeResult = await callContract(
      routeSafeRPCRequest,
      origin,
      qnnsAddress,
      qnnsInterface,
      "isActive",
      [nameHash]
    )
    const active = Boolean(activeResult[0])
    if (!active) return { active, owner: null }

    const ownerResult = await callContract(
      routeSafeRPCRequest,
      origin,
      qnnsAddress,
      qnnsInterface,
      "ownerOf",
      [BigInt(nameHash)]
    )
    return { active, owner: String(ownerResult[0]) }
  } catch (_) {
    return { active: null, owner: null }
  }
}

async function readAnchor(
  routeSafeRPCRequest: SafeRPCRequest,
  origin: string,
  qnsAnchorRegistryAddress: string,
  nameHash: string
): Promise<PelagusQNSAnchorPayload | null> {
  if (!qnsAnchorRegistryAddress) return null

  const result = await callContract(
    routeSafeRPCRequest,
    origin,
    qnsAnchorRegistryAddress,
    anchorRegistryInterface,
    "anchorOf",
    [nameHash]
  )
  const encodedAnchor = String(result[0])
  if (!encodedAnchor || encodedAnchor === "0x") return null
  const anchor = decodeAnchor(encodedAnchor)
  if (anchor.version !== ANCHOR_VERSION) {
    throw new EIP1193Error({
      ...EIP1193_ERROR_CODES.unsupportedMethod,
      data: { reason: "Unsupported QNS anchor version." },
    })
  }
  return anchor
}

async function readModule(
  routeSafeRPCRequest: SafeRPCRequest,
  origin: string,
  moduleAddress: string,
  chainId: string,
  expectedAnchor?: PelagusQNSAnchorPayload | null
): Promise<PelagusQNSGetModuleResult> {
  if (!isAddress(moduleAddress)) {
    throw new EIP1193Error({
      ...EIP1193_ERROR_CODES.unsupportedMethod,
      data: { reason: "Invalid QNS module address." },
    })
  }

  const normalizedModuleAddress = getAddress(moduleAddress)
  const [versionResult, topologyResult, manifestHashResult, manifestResult] =
    await Promise.all([
      callContract(
        routeSafeRPCRequest,
        origin,
        normalizedModuleAddress,
        moduleInterface,
        "moduleVersion",
        []
      ),
      callContract(
        routeSafeRPCRequest,
        origin,
        normalizedModuleAddress,
        moduleInterface,
        "moduleTopology",
        []
      ),
      callContract(
        routeSafeRPCRequest,
        origin,
        normalizedModuleAddress,
        moduleInterface,
        "moduleManifestHash",
        []
      ),
      callContract(
        routeSafeRPCRequest,
        origin,
        normalizedModuleAddress,
        moduleInterface,
        "moduleManifest",
        []
      ),
    ])

  const moduleVersion = Number(versionResult[0])
  const topology = String(topologyResult[0])
  const manifestHash = String(manifestHashResult[0])
  const manifest = String(manifestResult[0])

  if (keccak256(manifest).toLowerCase() !== manifestHash.toLowerCase()) {
    throw new EIP1193Error({
      ...EIP1193_ERROR_CODES.unsupportedMethod,
      data: { reason: "QNS module manifest hash mismatch." },
    })
  }

  if (expectedAnchor) {
    if (
      expectedAnchor.moduleAddress.toLowerCase() !==
        normalizedModuleAddress.toLowerCase() ||
      expectedAnchor.topology.toLowerCase() !== topology.toLowerCase() ||
      expectedAnchor.manifestHash.toLowerCase() !== manifestHash.toLowerCase()
    ) {
      throw new EIP1193Error({
        ...EIP1193_ERROR_CODES.unsupportedMethod,
        data: { reason: "QNS anchor does not match module introspection." },
      })
    }
  }

  const manifestDecoded = decodeModuleManifest(manifest)
  const supported =
    topology.toLowerCase() === MODULE_IDS.topologyRedirect.toLowerCase() ||
    topology.toLowerCase() === MODULE_IDS.topologyStaticSite.toLowerCase()

  return {
    anchor: expectedAnchor ?? null,
    chainId: expectedAnchor?.chainId ?? toHexChainId(chainId),
    defaultRoute: manifestDecoded.defaultRoute,
    manifest,
    manifestDecoded,
    manifestHash,
    moduleAddress: normalizedModuleAddress,
    moduleVersion,
    nameHash: "",
    rendererId: manifestDecoded.rendererId,
    supported,
    title: manifestDecoded.title,
    topology,
    verified: true,
  }
}

async function resolveName({
  params,
  origin,
  chainId,
  routeSafeRPCRequest,
}: QNSProviderContext): Promise<PelagusQNSResolveNameResult> {
  const input = parseNameInput(params, chainId)
  const normalizedName = normalizeQNSName(input.name)
  const nameHash = hashQNSName(normalizedName)
  const { active, owner } = await readNameOwner(
    routeSafeRPCRequest,
    origin,
    input.qnsNameResolverAddress ?? "",
    input.qnnsAddress ?? "",
    nameHash
  )
  const anchor = await readAnchor(
    routeSafeRPCRequest,
    origin,
    input.qnsAnchorRegistryAddress ?? "",
    nameHash
  )

  return {
    active,
    anchor,
    chainId: toHexChainId(chainId),
    name: input.name,
    nameHash,
    normalizedName,
    owner,
    qnnsAddress: input.qnnsAddress || null,
    qnsNameResolverAddress: input.qnsNameResolverAddress || null,
    qnsAnchorRegistryAddress: input.qnsAnchorRegistryAddress || null,
  }
}

async function getModule(
  context: QNSProviderContext
): Promise<PelagusQNSGetModuleResult> {
  const input = parseModuleInput(context.params, context.chainId)
  if (input.moduleAddress) {
    return readModule(
      context.routeSafeRPCRequest,
      context.origin,
      input.moduleAddress,
      context.chainId
    )
  }

  const resolved = await resolveName(context)
  if (!resolved.anchor) {
    throw new EIP1193Error({
      ...EIP1193_ERROR_CODES.unsupportedMethod,
      data: { reason: "No QNS module anchor found for this name." },
    })
  }

  const module = await readModule(
    context.routeSafeRPCRequest,
    context.origin,
    resolved.anchor.moduleAddress,
    context.chainId,
    resolved.anchor
  )

  return {
    ...module,
    nameHash: resolved.nameHash,
  }
}

async function openQNS(
  context: QNSProviderContext
): Promise<PelagusQNSOpenResult> {
  const input = parseModuleInput(context.params, context.chainId)
  if (input.moduleAddress) {
    const module = await getModule(context)
    return {
      chainId: module.chainId,
      module,
      url: gatewayModulesUrl({ module: module.moduleAddress }),
    }
  }

  const resolution = await resolveName(context)
  return {
    chainId: resolution.chainId,
    resolution,
    url: gatewayModulesUrl({
      name: resolution.normalizedName,
      resolver: resolution.qnsNameResolverAddress,
      registry: resolution.qnsAnchorRegistryAddress,
    }),
  }
}

export async function handleQNSProviderMethod(
  context: QNSProviderContext
): Promise<
  PelagusQNSResolveNameResult | PelagusQNSGetModuleResult | PelagusQNSOpenResult
> {
  switch (context.method) {
    case PELAGUS_QNS_RESOLVE_NAME_METHOD:
      return resolveName(context)
    case PELAGUS_QNS_GET_MODULE_METHOD:
      return getModule(context)
    case PELAGUS_QNS_OPEN_METHOD:
      return openQNS(context)
    default:
      throw new EIP1193Error(EIP1193_ERROR_CODES.unsupportedMethod)
  }
}
