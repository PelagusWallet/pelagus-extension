# QNS Module Provider Integration

Draft status: implementation target for Pelagus.

## Goal

Pelagus should support QNS modules as a general website/app bootstrap layer, not as publishing-specific logic. A QNS name resolves to a compact module anchor, and the anchor tells a wallet browser or gateway how to load the site.

Pelagus does not need to render every topology in v1. The first useful surface is a read-only provider contract plus a safe open/redirect path.

## Provider Methods

Recommended read-only methods:

```text
pelagus_qnsResolveName(name) -> { nameHash, owner, anchor, chainId }
pelagus_qnsGetModule(nameOrNameHash) -> { anchor, moduleAddress, topology, manifestHash, manifest, chainId }
pelagus_qnsOpen(url) -> opens qns:// or https://qns.app route through the approved browser/gateway surface
```

Rules:

- These are wallet-owned `pelagus_*` methods because the provider bridge already reserves that namespace for Pelagus capabilities.
- `pelagus_qnsResolveName` normalizes `name`, computes `nameHash`, checks QNS/QNNS ownership through `QNSNameResolver` when configured, and returns the compact anchor.
- `pelagus_qnsGetModule` verifies the module manifest hash before returning manifest bytes.
- `pelagus_qnsOpen` is a navigation request only. It must not sign or submit transactions.
- All write actions continue to use normal transaction request methods.
- Responses must include the chain/network used for resolution.

## Open Flow

When a dapp asks Pelagus to open a QNS URL:

1. Parse `qns://name/path?query`, `qns://0x<moduleAddress>`, `https://qns.app/name/path?query`, or `https://qns.app/modules?module=0x<moduleAddress>`.
2. If the target is a module address, skip name resolution and verify the module directly.
3. If the target is a name, normalize it using the v1 ASCII-only rules and resolve the QNS anchor through the configured `QNSAnchorRegistry`.
4. Verify the module manifest hash.
5. Check that the topology and renderer are supported by this Pelagus build.
6. Show the user the QNS name or direct module address, destination, topology, and module address when available.
7. Open the route through the approved browser/gateway surface.
8. Scope future wallet permissions to the resolved QNS origin.

V1 name normalization:

```text
^[a-z0-9_-]{1,64}$
```

Pelagus may lowercase ASCII user input before resolution. It must reject Unicode, dots, spaces, slashes inside the name, and any bytes outside the canonical grammar.

Canonical QNS origin:

```text
qns:<nameHash>
```

Gateway host should not become the app identity shown to the user.

## Phased Implementation

1. Add URL normalization helpers for `qns://` and `https://qns.app/...`.
2. Support direct module-address URLs such as `qns://0x...`.
3. Route QNS links to the public gateway if Pelagus has no native browser surface.
4. Add read-only provider methods for QNS resolution.
5. Add native module rendering later if Pelagus gains a first-party browser surface.

The extension background can also rewrite `qns://...` tab navigations into the configured gateway when the browser exposes that navigation event. Reliable address-bar interception may require an explicit browser permission such as `tabs` or `webNavigation`, which should be reviewed separately because it broadens extension access.

## Pelagus Code Touchpoints

Provider method names should be declared in:

```text
provider-bridge-shared/constants.ts
```

Provider method result types should be declared in:

```text
provider-bridge-shared/types.ts
```

The provider bridge should route `pelagus_qns*` methods before generic RPC permission checks:

```text
background/services/provider-bridge/index.ts
```

The actual read path can use the existing internal provider support for `quai_call`:

```text
background/services/internal-quai-provider/index.ts
```

Do not implement QNS resolution as page JavaScript. The extension should own the QNS resolver path so it can enforce network selection, manifest hash verification, and QNS-origin permission scoping consistently.

## MVP Resolver Inputs

Pelagus needs these deployment constants before code can fully resolve modules:

```ts
type QNSResolverConfig = {
  chainId: string
  qnnsAddress: string
  qnsNameResolverAddress: string
  qnsAnchorRegistryAddress: string
  qnsGatewayBaseUrl: string
  supportedTopologies: string[]
  supportedRenderers: string[]
}
```

Rules:

- `chainId` is the EIP-1193 hex chain ID returned by `quai_chainId`.
- `qnsNameResolverAddress` is preferred for ownership/active-state checks. It should expose `ownerOfName(bytes32) -> (address owner, bool active)`.
- `qnnsAddress` remains a compatibility fallback for current QNNS contracts that expose `isActive(bytes32)` and `ownerOf(uint256)`.
- The module anchor stores the same chain ID as a `uint64`.
- Quai zone routing is derived from the module/content contract addresses and the selected network provider.
- `qnsGatewayBaseUrl` is a configured deployment value. Use `https://qns.app` only as a placeholder until the production gateway domain is finalized.
- Pelagus must not accept QNS registry addresses from page JavaScript.
- Pelagus must return a standard unsupported/unconfigured provider error when the active chain has no QNS resolver config.
- Runtime methods should never return `null` for recognized QNS methods.

Until resolver config is finalized, Pelagus can reserve provider method names and document the response contract without performing live resolution.

## Manifest Support

Pelagus should support only built-in renderer IDs in v1:

```text
qns.renderer.redirect.v1
qns.renderer.bootstrap.v1
qns.renderer.static-safe.v1
qns.renderer.publish.v1
```

Unknown renderer IDs fail closed or open through the public gateway without provider injection.

Static site modules must not execute JavaScript. Any richer app should use a component graph or app-contract renderer.

`qns.renderer.qi-ephemeral.v1` is reserved for a later renderer that can interpret
bounded, short-lived Qi transaction data. It is not part of the first native
renderer path. When added, it should expose structured wallet-owned actions, not
raw Qi input construction from page JavaScript.

Future Qi ephemeral modules may request existing Qi provider methods such as:

```text
qi_getReceiveAddresses
qi_sendToOutputs
```

If a dedicated method is added later, prefer a structured call such as
`qi_publishEphemeralData` so Pelagus can decode the packet and show a
human-readable confirmation before signing.

## Security Notes

- Do not execute contract-returned bytes as JavaScript.
- Verify anchor topology and manifest hash before exposing module data.
- Enforce redirect/bootstrap depth limits.
- Do not preserve wallet permissions across QNS redirects.
- Unknown topologies should fail closed or open through a trusted gateway without provider permissions.
- Qi ephemeral renderers must treat Qi data as bounded/prunable and must not require archival Qi history for normal rendering.
