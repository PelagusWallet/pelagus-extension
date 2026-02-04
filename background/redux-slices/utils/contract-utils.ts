import Emittery from "emittery"
import { AddressLike, BrowserProvider } from "quais"
import PelagusWindowProvider from "@pelagus-provider/window-provider"
import { decode } from 'cbor-x';
import bs58 from 'bs58';
import { arrayify } from "@ethersproject/bytes";
import { splitAuxdata, AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';
import { Interface, Provider, quais } from "quais";
import type { FunctionFragment } from "quais";

type InternalProviderPortEvents = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any
}

/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
// This is a compatibility shim that allows treating the internal provider as
// if it's communicating over a port, so that the PelagusWindowProvider can
// interact with it directly.
export const internalProviderPort = {
  listeners: [] as ((message: any) => unknown)[],
  emitter: new Emittery<InternalProviderPortEvents>(),
  addEventListener(listener: (message: any) => unknown): void {
    this.listeners.push(listener)
  },
  removeEventListener(toRemove: (message: any) => unknown): void {
    this.listeners = this.listeners.filter((listener) => listener !== toRemove)
  },
  origin: self.location.origin,
  postMessage(message: any): void {
    this.emitter.emit("message", message)
  },
  postResponse(message: any): void {
    this.listeners.forEach((listener) => listener(message))
  },
}

const internalProvider = new PelagusWindowProvider(internalProviderPort)

export function getProvider(this: unknown): BrowserProvider {
  return new BrowserProvider(internalProvider)
}


export const decodeMultipleMetadataSections = async (bytecode: string): Promise<Array<any>> => {
  if (!bytecode || bytecode.length === 0) {
    throw new Error('Bytecode cannot be empty');
  }

  const metadataSections = [];
  let remainingBytecode = bytecode;

  while (remainingBytecode.length > 0) {
    try {
      const [executionBytecode, auxdata] = splitAuxdata(remainingBytecode, AuxdataStyle.SOLIDITY);

      if (auxdata) {
        const decodedMetadata = decode(arrayify(`0x${auxdata}`));
        metadataSections.push(decodedMetadata);
        remainingBytecode = executionBytecode ?? '';
      } else {
        break;
      }
    } catch (error: any) {
      console.error('Failed to decode metadata section:', error);
      break;
    }
  }

  return metadataSections.map((metadata) => ({
    ...metadata,
    ipfs: metadata.ipfs ? bs58.encode(metadata.ipfs) : undefined,
  }));
};


export const getABIFromAddressAndIPFS = async (address: string, ipfsUrl: string, provider: Provider, depth = 0): Promise<Array<any> | undefined> => {
  try {
    const resolvedAddress = quais.getAddress(address)
    const bytecode = await provider.getCode(resolvedAddress);
    if (bytecode === '0x' || bytecode === '0x0' || bytecode.length === 0) throw new Error('No contract found at this address');
    const metadataSections = await decodeMultipleMetadataSections(bytecode);
    if (metadataSections.length > 1) {
      console.log(`Found ${metadataSections.length} metadata sections for address ${address}, using the first one`);
    } else if (metadataSections.length === 0) {
      const impl = getImplementationFrom1167(bytecode);
      if (impl && depth < 5) {
          return getABIFromAddressAndIPFS(impl, ipfsUrl, provider, depth + 1);  // recurse once
      }

      throw new Error('ABI not found (no metadata, not a proxy)');
    }
    const ipfsCid = metadataSections[0]?.ipfs;
    if (!ipfsCid) throw new Error('No IPFS metadata found in bytecode');
    // Fetch ABI from IPFS
    const url = `${ipfsUrl}/ipfs/${ipfsCid}`
    const response = await fetch(url);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to fetch metadata: ${response.statusText} (Status: ${response.status})`);
    }
    const metadata = await response.json() as any;

    const parsedAbi = Interface.from(metadata.output.abi);
    
    // Check if this looks like a proxy ABI (only proxy-specific functions)
    // OR if the ABI has no functions at all (some proxies only use fallback)
    const hasNoFunctions = !parsedAbi.fragments.some((f) => f.type === 'function');
    
    if (looksLikeTransparentProxyAbi(parsedAbi) || hasNoFunctions) {
      const impl = await getImplementationFrom1967(provider, resolvedAddress);
      if (impl && depth < 5) {
        return getABIFromAddressAndIPFS(impl, ipfsUrl, provider, depth + 1);  // recurse once
      }
    }
    return metadata.output.abi; // Return the ABI
  } catch (e) {
    console.error(e)
  }
};

/**
 * If `code` is an EIP-1167 minimal-proxy return the embedded implementation
 * address, otherwise return `undefined`.
 */
export function getImplementationFrom1167(code: string): string | undefined {
  // minimal-proxy is always 45 bytes (0x2d) long
  const cleaned = code.replace(/^0x/, '').toLowerCase();
  if (cleaned.length !== 2 * 45) return;

  // opcode layout: … 36 3d 73 <20-byte-impl> 5a f4 3d 82 …
  const prefix  = '363d3d373d3d3d363d73';
  const suffix  = '5af43d82803e903d91602b57fd5bf3';

  if (!cleaned.startsWith(prefix) || !cleaned.endsWith(suffix)) return;

  const implHex = cleaned.slice(prefix.length, prefix.length + 40);
  return quais.getAddress('0x' + implHex);   // checksums & validates
}

async function getImplementationFrom1967(
  provider: Provider,
  proxy: string,
): Promise<string | undefined> {
  // bytes32(uint256(keccak256('eip1967.proxy.implementation'))-1)
  const slot =
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const raw = await provider.getStorage(proxy, slot);
  const addr = quais.getAddress('0x' + raw.slice(26)); // last 20 bytes
  if (addr === quais.ZeroAddress) return;
  // extra sanity: there must be *some* code at impl
  return (await provider.getCode(addr)) !== '0x' ? addr : undefined;
}

/**
 * Detects if an ABI looks like a proxy contract.
 * 
 * Returns true if the ABI contains ANY known proxy function,
 * meaning we should check the EIP-1967 implementation slot.
 * 
 * False positives are safe — if the slot is empty, we return the original ABI.
 */
function looksLikeTransparentProxyAbi(abi: Interface | undefined): boolean {
  if (!abi) return false;

  // Known proxy function names across various proxy patterns
  const PROXY_FUNCTIONS = new Set([
    // OpenZeppelin TransparentUpgradeableProxy
    'implementation', 
    'upgradeTo',
    'upgradeToAndCall',
    'changeAdmin',
    // EIP-1967 beacon proxy
    'beacon',
    'setBeacon',
    // Gnosis Safe / other patterns
    'masterCopy',
    // EIP-2535 Diamond proxy
    'facets',
    'facetFunctionSelectors',
    'facetAddresses',
    'facetAddress',
    'diamondCut',
    // Common proxy helpers
    'proxyType',
    'proxyOwner',
    'pendingProxyOwner',
    'transferProxyOwnership',
    'claimProxyOwnership',
    'getImplementation',
    'getAdmin',
    'getBeacon',
  ]);

  // Get all function fragments
  const functions = abi.fragments.filter(
    (f): f is FunctionFragment => f.type === 'function'
  );

  // If the contract has ANY known proxy function, check the EIP-1967 slot
  return functions.some((fn) => PROXY_FUNCTIONS.has(fn.name));
}