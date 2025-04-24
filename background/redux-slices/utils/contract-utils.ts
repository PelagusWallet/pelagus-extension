import Emittery from "emittery"
import { BrowserProvider } from "quais"
import PelagusWindowProvider from "@pelagus-provider/window-provider"
import { decode } from 'cbor-x';
import bs58 from 'bs58';
import { arrayify } from "@ethersproject/bytes";
import { splitAuxdata, AuxdataStyle } from '@ethereum-sourcify/bytecode-utils';

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
              remainingBytecode = executionBytecode;
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
