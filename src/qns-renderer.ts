import {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  ZeroHash,
  getBytes,
  getAddress,
  isAddress,
  keccak256,
  solidityPackedKeccak256,
  toUtf8Bytes,
  toUtf8String,
} from "quais"

const QNS_MODULE_IDS = {
  topologyStaticSite: keccak256(toUtf8Bytes("qns.topology.static-site.v1")),
  rendererStaticSafe: keccak256(toUtf8Bytes("qns.renderer.static-safe.v1")),
  mimeTextMarkdown: keccak256(toUtf8Bytes("text/markdown")),
  mimeTextPlain: keccak256(toUtf8Bytes("text/plain")),
  mimeTextHtml: keccak256(toUtf8Bytes("text/html")),
  mimeTextCss: keccak256(toUtf8Bytes("text/css")),
}

const RPC_URL =
  process.env.QNS_MAINNET_RPC_URL ||
  process.env.QNS_RPC_URL ||
  "https://rpc.quai.network/cyprus1"
const QNS_ANCHOR_REGISTRY_ADDRESS =
  process.env.QNS_ANCHOR_REGISTRY_ADDRESS ||
  process.env.QNS_MAINNET_ANCHOR_REGISTRY_ADDRESS ||
  ""
const QNS_NAME_RESOLVER_ADDRESS =
  process.env.QNS_NAME_RESOLVER_ADDRESS ||
  process.env.QNS_MAINNET_NAME_RESOLVER_ADDRESS ||
  ""
const QNS_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const QNS_ANCHOR_BYTES = 96

const QNS_MODULE_ABI = [
  "function moduleVersion() view returns (uint16)",
  "function moduleTopology() view returns (bytes32)",
  "function moduleManifestHash() view returns (bytes32)",
  "function moduleManifest() view returns (bytes)",
]

const QNS_STATIC_CONTENT_STORE_ABI = [
  "function getContentChunk(uint256 contentId, uint16 chunkIndex) view returns (bytes)",
]
const QNS_ANCHOR_REGISTRY_ABI = [
  "function nameResolver() view returns (address)",
  "function anchorOf(bytes32 nameHash) view returns (bytes)",
]
const QNS_NAME_RESOLVER_ABI = [
  "function ownerOfName(bytes32 nameHash) view returns (address owner, bool active)",
]

const MODULE_MANIFEST_V1_ABI =
  "tuple(uint16,bytes32,bytes32,bytes32,string,string,tuple(uint32,bytes32[]),tuple(uint32,uint32,uint32,uint32,uint32),bytes)"
const STATIC_SITE_MANIFEST_V1_ABI =
  "tuple(address,string,bytes32,uint8,tuple(string,bytes32,uint32,bytes32,uint256,uint16)[])"

type ModuleManifestV1 = {
  version: number
  topology: string
  rendererId: string
  title: string
  defaultRoute: string
  topologyData: string
}

type StaticFileRefV1 = {
  path: string
  mimeType: string
  byteLength: number
  contentHash: string
  contentId: bigint
  chunkCount: number
}

type StaticSiteManifestV1 = {
  contentStore: string
  entryPath: string
  htmlPolicy: number
  files: StaticFileRefV1[]
}

type StaticFileContent = {
  file: StaticFileRefV1
  text: string
}

type QNSAnchor = {
  version: number
  flags: number
  chainId: bigint
  moduleAddress: string
  topology: string
  manifestHash: string
}

type QNSResolvedTarget = {
  moduleAddress: string
  anchor?: QNSAnchor
}

const coder = AbiCoder.defaultAbiCoder()
const root = document.getElementById("qns-root")

function normalizeHex(value: string): string {
  return value.toLowerCase()
}

function setPageChrome() {
  document.documentElement.style.height = "100%"
  document.body.style.height = "100%"
  document.body.style.margin = "0"
  document.body.style.background = "#101114"
  document.body.style.color = "#f2f1ec"
  document.body.style.fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
}

function setStatus(title: string, message: string) {
  if (!root) return
  root.innerHTML = ""
  const shell = document.createElement("main")
  shell.style.cssText =
    "min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box;"

  const panel = document.createElement("section")
  panel.style.cssText =
    "width:min(680px,100%);border:1px solid #38342c;background:#191b20;border-radius:8px;padding:28px;box-sizing:border-box;"

  const heading = document.createElement("h1")
  heading.textContent = title
  heading.style.cssText = "margin:0 0 12px;font-size:22px;line-height:1.2;"

  const body = document.createElement("p")
  body.textContent = message
  body.style.cssText = "margin:0;color:#b7b2a8;line-height:1.6;"

  panel.append(heading, body)
  shell.append(panel)
  root.append(shell)
}

function normalizeQNSName(input: string): string {
  let value = input.trim()
  if (value.endsWith(".quai")) value = value.slice(0, -5)
  if (value.endsWith(".qns")) value = value.slice(0, -4)
  value = value.toLowerCase()
  if (!/^[a-z0-9_-]{1,64}$/.test(value)) {
    throw new Error("Invalid QNS name.")
  }
  return value
}

function decodeAnchor(anchorBytes: string): QNSAnchor {
  const hex = anchorBytes.startsWith("0x") ? anchorBytes.slice(2) : anchorBytes
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length !== QNS_ANCHOR_BYTES * 2) {
    throw new Error("Invalid QNS anchor.")
  }

  return {
    version: Number.parseInt(hex.slice(0, 4), 16),
    flags: Number.parseInt(hex.slice(4, 8), 16),
    chainId: BigInt(`0x${hex.slice(8, 24)}`),
    moduleAddress: getAddress(`0x${hex.slice(24, 64)}`),
    topology: `0x${hex.slice(64, 128)}`,
    manifestHash: `0x${hex.slice(128, 192)}`,
  }
}

async function resolveNameTarget(
  provider: JsonRpcProvider,
  rawName: string
): Promise<QNSResolvedTarget> {
  if (!QNS_ANCHOR_REGISTRY_ADDRESS || !isAddress(QNS_ANCHOR_REGISTRY_ADDRESS)) {
    throw new Error("QNS name resolution is not configured in Pelagus.")
  }

  const name = normalizeQNSName(rawName)
  const nameHash = solidityPackedKeccak256(["string"], [name])
  const registry = new Contract(
    QNS_ANCHOR_REGISTRY_ADDRESS,
    QNS_ANCHOR_REGISTRY_ABI,
    provider
  )

  const [registryNameResolver, anchorBytes] = await Promise.all([
    registry.nameResolver(),
    registry.anchorOf(nameHash),
  ])
  if (!anchorBytes || anchorBytes === "0x") {
    throw new Error("No QNS module anchor found for this name.")
  }

  const resolverAddress =
    QNS_NAME_RESOLVER_ADDRESS && isAddress(QNS_NAME_RESOLVER_ADDRESS)
      ? QNS_NAME_RESOLVER_ADDRESS
      : String(registryNameResolver)
  if (resolverAddress && isAddress(resolverAddress)) {
    const resolver = new Contract(resolverAddress, QNS_NAME_RESOLVER_ABI, provider)
    const ownerRecord = await resolver.ownerOfName(nameHash)
    if (!Boolean(ownerRecord[1])) {
      throw new Error("QNS name is not active.")
    }
  }

  const anchor = decodeAnchor(anchorBytes)
  return {
    moduleAddress: anchor.moduleAddress,
    anchor,
  }
}

async function resolveTarget(provider: JsonRpcProvider): Promise<QNSResolvedTarget> {
  const params = new URLSearchParams(window.location.search)
  const moduleAddress = params.get("module") || params.get("moduleAddress")
  if (moduleAddress) {
    if (!isAddress(moduleAddress)) throw new Error("Invalid QNS module address.")
    return { moduleAddress: getAddress(moduleAddress) }
  }

  const name = params.get("name") || params.get("qns")
  if (name) {
    if (QNS_ADDRESS_PATTERN.test(name)) return { moduleAddress: getAddress(name) }
    return resolveNameTarget(provider, name)
  }

  throw new Error("Missing QNS module address or name.")
}

function decodeModuleManifest(manifestBytes: string): ModuleManifestV1 {
  const decoded = coder.decode([MODULE_MANIFEST_V1_ABI], manifestBytes)[0] as any
  return {
    version: Number(decoded[0]),
    topology: String(decoded[1]),
    rendererId: String(decoded[2]),
    title: String(decoded[4]),
    defaultRoute: String(decoded[5]),
    topologyData: String(decoded[8]),
  }
}

function decodeStaticSiteManifest(
  topologyData: string
): StaticSiteManifestV1 {
  const decoded = coder.decode([STATIC_SITE_MANIFEST_V1_ABI], topologyData)[0] as any
  return {
    contentStore: String(decoded[0]),
    entryPath: String(decoded[1]),
    htmlPolicy: Number(decoded[3]),
    files: Array.from(decoded[4] || []).map((file: any) => ({
      path: String(file[0]),
      mimeType: String(file[1]),
      byteLength: Number(file[2]),
      contentHash: String(file[3]),
      contentId: BigInt(file[4]),
      chunkCount: Number(file[5]),
    })),
  }
}

async function readStaticFile(
  provider: JsonRpcProvider,
  staticSite: StaticSiteManifestV1,
  file: StaticFileRefV1
): Promise<StaticFileContent> {
  if (!isAddress(staticSite.contentStore)) {
    throw new Error("Invalid static content store address.")
  }

  const store = new Contract(
    staticSite.contentStore,
    QNS_STATIC_CONTENT_STORE_ABI,
    provider
  )
  const chunks: Uint8Array[] = []
  for (let i = 0; i < file.chunkCount; i++) {
    chunks.push(getBytes(await store.getContentChunk(file.contentId, i)))
  }

  const bytes = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  )
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }

  if (bytes.length !== file.byteLength) {
    throw new Error("Static file byte length mismatch.")
  }
  if (normalizeHex(keccak256(bytes)) !== normalizeHex(file.contentHash)) {
    throw new Error(`Static file hash mismatch for ${file.path}.`)
  }

  return { file, text: toUtf8String(bytes) }
}

function sanitizeHtml(input: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(input, "text/html")

  doc
    .querySelectorAll("script,iframe,object,embed,base,link,meta[http-equiv]")
    .forEach((node) => node.remove())

  const elements = Array.from(doc.querySelectorAll("*"))
  for (const element of elements) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim().toLowerCase()
      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        name === "style" ||
        value.startsWith("javascript:")
      ) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  return `<!doctype html>\n${doc.documentElement.outerHTML}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function markdownToHtml(markdown: string): string {
  const blocks = markdown.split(/\n{2,}/)
  return blocks
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ""
      if (trimmed.startsWith("# ")) return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`
      if (trimmed.startsWith("## ")) return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`
      return `<p>${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`
    })
    .join("\n")
}

function renderFrame(title: string, bodyHtml: string, cssText: string) {
  if (!root) return
  root.innerHTML = ""

  const frame = document.createElement("iframe")
  frame.setAttribute("sandbox", "")
  frame.setAttribute("title", title)
  frame.style.cssText =
    "display:block;width:100%;height:100vh;border:0;background:#101114;"

  const parser = new DOMParser()
  const doc = parser.parseFromString(bodyHtml, "text/html")
  const style = doc.createElement("style")
  style.textContent = cssText
  doc.head.append(style)
  frame.srcdoc = `<!doctype html>\n${doc.documentElement.outerHTML}`

  root.append(frame)
}

function renderText(title: string, text: string) {
  const html = [
    "<html>",
    "<head>",
    `<title>${escapeHtml(title)}</title>`,
    "</head>",
    "<body>",
    `<main>${markdownToHtml(text)}</main>`,
    "</body>",
    "</html>",
  ].join("")
  const css = [
    "body{margin:0;background:#101114;color:#f2f1ec;font-family:Inter,ui-sans-serif,system-ui,sans-serif;}",
    "main{width:min(820px,calc(100% - 32px));margin:0 auto;padding:56px 0;line-height:1.7;}",
    "h1{font-size:clamp(32px,7vw,64px);line-height:1;margin:0 0 24px;}",
    "h2{font-size:28px;margin:28px 0 12px;}",
    "p{color:#b7b2a8;font-size:18px;}",
  ].join("")
  renderFrame(title, html, css)
}

async function loadAndRender() {
  setPageChrome()
  setStatus("Loading QNS module", "Reading module manifest and static bytes from Quai.")

  const provider = new JsonRpcProvider(RPC_URL, undefined, { usePathing: false })
  const resolvedTarget = await resolveTarget(provider)
  const moduleAddress = resolvedTarget.moduleAddress
  const module = new Contract(moduleAddress, QNS_MODULE_ABI, provider)

  const [network, version, topology, manifestHash, manifestBytes] = await Promise.all([
    provider.getNetwork(),
    module.moduleVersion(),
    module.moduleTopology(),
    module.moduleManifestHash(),
    module.moduleManifest(),
  ])

  if (Number(version) !== 1) throw new Error("Unsupported QNS module version.")
  if (resolvedTarget.anchor) {
    if (resolvedTarget.anchor.version !== Number(version)) {
      throw new Error("QNS anchor version does not match module version.")
    }
    if (resolvedTarget.anchor.chainId !== network.chainId) {
      throw new Error("QNS anchor chain ID does not match the active network.")
    }
    if (normalizeHex(resolvedTarget.anchor.topology) !== normalizeHex(String(topology))) {
      throw new Error("QNS anchor topology does not match module topology.")
    }
    if (normalizeHex(resolvedTarget.anchor.manifestHash) !== normalizeHex(String(manifestHash))) {
      throw new Error("QNS anchor manifest hash does not match module manifest hash.")
    }
  }
  if (normalizeHex(String(topology)) !== normalizeHex(QNS_MODULE_IDS.topologyStaticSite)) {
    throw new Error("Only static-site QNS modules are supported in this renderer.")
  }
  if (normalizeHex(keccak256(manifestBytes)) !== normalizeHex(String(manifestHash))) {
    throw new Error("QNS module manifest hash mismatch.")
  }

  const manifest = decodeModuleManifest(manifestBytes)
  if (
    normalizeHex(manifest.rendererId) !==
    normalizeHex(QNS_MODULE_IDS.rendererStaticSafe)
  ) {
    throw new Error("Unsupported QNS renderer.")
  }

  const staticSite = decodeStaticSiteManifest(manifest.topologyData)
  const files = await Promise.all(
    staticSite.files.map((file) => readStaticFile(provider, staticSite, file))
  )
  const entry =
    files.find((file) => file.file.path === staticSite.entryPath) || files[0]
  if (!entry) throw new Error("Static-site module has no entry file.")

  const cssText = files
    .filter(
      (file) =>
        normalizeHex(file.file.mimeType) === normalizeHex(QNS_MODULE_IDS.mimeTextCss)
    )
    .map((file) => file.text)
    .join("\n")

  const entryMime = normalizeHex(entry.file.mimeType)
  if (entryMime === normalizeHex(QNS_MODULE_IDS.mimeTextHtml)) {
    if (staticSite.htmlPolicy !== 2) {
      throw new Error("This module does not allow sanitized HTML rendering.")
    }
    renderFrame(manifest.title || "QNS", sanitizeHtml(entry.text), cssText)
    return
  }

  if (
    entryMime === normalizeHex(QNS_MODULE_IDS.mimeTextMarkdown) ||
    entryMime === normalizeHex(QNS_MODULE_IDS.mimeTextPlain) ||
    entryMime === normalizeHex(ZeroHash)
  ) {
    renderText(manifest.title || "QNS", entry.text)
    return
  }

  throw new Error("Unsupported static-site entry MIME type.")
}

loadAndRender().catch((error) => {
  setPageChrome()
  setStatus("Unable to load QNS module", error?.message || String(error))
})
