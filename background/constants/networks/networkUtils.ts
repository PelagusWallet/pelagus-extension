import { NetworkInterface } from "./networkTypes"

export const isQuaiHandle = (network: NetworkInterface): boolean =>
  network.family === "EVM"
